import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRefreshTokenMock,
  setTokenMock,
  refreshTokenApiMock,
  isCookieAuthSessionMock,
  cookiesGetMock
} = vi.hoisted(() => ({
  getRefreshTokenMock: vi.fn(),
  setTokenMock: vi.fn(),
  refreshTokenApiMock: vi.fn(),
  isCookieAuthSessionMock: vi.fn(),
  cookiesGetMock: vi.fn()
}));

vi.mock("@/utils/auth", () => ({
  getRefreshToken: getRefreshTokenMock,
  setToken: setTokenMock,
  isCookieAuthSession: isCookieAuthSessionMock,
  multipleTabsKey: "multiple-tabs"
}));

vi.mock("js-cookie", () => ({
  default: {
    get: cookiesGetMock,
    set: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock("@/api/auth", () => ({
  refreshTokenApi: refreshTokenApiMock
}));

type RefreshModule = typeof import("./refreshToken");
let refreshAccessToken: RefreshModule["refreshAccessToken"];

describe("refreshAccessToken 单飞原语", () => {
  beforeEach(async () => {
    // 单飞 Promise 是模块级状态：每个用例重新加载模块，避免上一用例的
    // 未决 inflight 泄漏到下一用例。
    vi.resetModules();
    ({ refreshAccessToken } = await import("./refreshToken"));
    getRefreshTokenMock.mockReset().mockReturnValue("refresh-1");
    setTokenMock.mockReset();
    refreshTokenApiMock.mockReset();
    // 默认 header 模式（既有用例的行为基线）
    isCookieAuthSessionMock.mockReset().mockReturnValue(false);
    cookiesGetMock.mockReset().mockReturnValue(undefined);
  });

  it("无 refresh token 时直接失败且不打接口", async () => {
    getRefreshTokenMock.mockReturnValue("");
    await expect(refreshAccessToken()).resolves.toEqual({
      ok: false,
      detail: ""
    });
    expect(refreshTokenApiMock).not.toHaveBeenCalled();
  });

  it("并发刷新只打一次接口，成功后统一写回 token", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    let resolveApi: (value: unknown) => void = () => undefined;
    refreshTokenApiMock.mockReturnValue(
      new Promise(resolve => {
        resolveApi = resolve;
      })
    );

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    // refreshTokenApi 在动态 import 之后才调用：等一拍再断言
    await vi.waitFor(() =>
      expect(refreshTokenApiMock).toHaveBeenCalledTimes(1)
    );
    resolveApi({ code: 1000, data: { access: "new", refresh: "r2" } });

    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({ ok: true });
    expect(setTokenMock).toHaveBeenCalledWith({
      access: "new",
      refresh: "r2"
    });
  });

  it("业务失败返回 detail 且不写 token", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    refreshTokenApiMock.mockResolvedValue({
      code: 1001,
      detail: "refresh expired"
    });
    await expect(refreshAccessToken()).resolves.toEqual({
      ok: false,
      detail: "refresh expired"
    });
    expect(setTokenMock).not.toHaveBeenCalled();
  });

  it("网络异常转成失败结果而不是抛出", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    const error = new Error("network");
    refreshTokenApiMock.mockRejectedValue(error);
    const outcome = await refreshAccessToken();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.detail).toBe("network");
      expect(outcome.error).toBe(error);
    }
  });

  it("http 层以响应体对象拒绝时取业务 detail（不再渲染 [object Object]）", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    const rejection = { code: 40002, status: 401, detail: "令牌无效或已过期" };
    refreshTokenApiMock.mockRejectedValue(rejection);
    const outcome = await refreshAccessToken();
    expect(outcome).toMatchObject({
      ok: false,
      detail: "令牌无效或已过期",
      error: rejection
    });
  });

  it("无法识别拒绝值形态时 detail 归一为空串", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    refreshTokenApiMock.mockRejectedValue({ code: 40002 });
    await expect(refreshAccessToken()).resolves.toMatchObject({
      ok: false,
      detail: ""
    });
  });

  it("header 模式按既有口径随请求体提交 refresh", async () => {
    getRefreshTokenMock.mockReturnValue("refresh-1");
    refreshTokenApiMock.mockResolvedValue({
      code: 1000,
      data: { access: "new", refresh: "r2" }
    });
    await expect(refreshAccessToken()).resolves.toMatchObject({ ok: true });
    expect(refreshTokenApiMock).toHaveBeenCalledWith({ refresh: "refresh-1" });
  });
});

describe("refreshAccessToken Cookie 会话模式", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ refreshAccessToken } = await import("./refreshToken"));
    getRefreshTokenMock.mockReset().mockReturnValue(undefined);
    setTokenMock.mockReset();
    refreshTokenApiMock.mockReset();
    isCookieAuthSessionMock.mockReset().mockReturnValue(true);
    cookiesGetMock.mockReset().mockReturnValue("true");
  });

  it("Cookie 模式提交空载荷（服务端按 X-Refresh-Token Cookie 双读）", async () => {
    refreshTokenApiMock.mockResolvedValue({
      code: 1000,
      data: { access: "", refresh: "", access_token_lifetime: 3600 }
    });
    await expect(refreshAccessToken()).resolves.toMatchObject({ ok: true });
    expect(refreshTokenApiMock).toHaveBeenCalledWith({});
    // 响应体 token 已剥离：setToken 只维护会话标记（token 由服务端 Set-Cookie 承载）
    expect(setTokenMock).toHaveBeenCalledWith({
      access: "",
      refresh: "",
      access_token_lifetime: 3600
    });
  });

  it("Cookie 模式无 multiple-tabs 会话标记时不打接口", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    await expect(refreshAccessToken()).resolves.toEqual({
      ok: false,
      detail: ""
    });
    expect(refreshTokenApiMock).not.toHaveBeenCalled();
  });

  it("Cookie 模式业务失败不写 token", async () => {
    refreshTokenApiMock.mockResolvedValue({ code: 1001, detail: "已过期" });
    await expect(refreshAccessToken()).resolves.toEqual({
      ok: false,
      detail: "已过期"
    });
    expect(setTokenMock).not.toHaveBeenCalled();
  });
});
