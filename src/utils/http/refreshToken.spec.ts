import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRefreshTokenMock, setTokenMock, refreshTokenApiMock } = vi.hoisted(
  () => ({
    getRefreshTokenMock: vi.fn(),
    setTokenMock: vi.fn(),
    refreshTokenApiMock: vi.fn()
  })
);

vi.mock("@/utils/auth", () => ({
  getRefreshToken: getRefreshTokenMock,
  setToken: setTokenMock
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
    getRefreshTokenMock.mockReset();
    setTokenMock.mockReset();
    refreshTokenApiMock.mockReset();
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
});
