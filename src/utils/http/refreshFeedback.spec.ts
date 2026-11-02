import { beforeEach, describe, expect, it, vi } from "vitest";

const { instanceMock, elMessageMock, interceptorHooks } = vi.hoisted(() => {
  const request = vi.fn();
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    request
  };
  // 捕获注册进来的请求拦截器，供刷新失败分支直接驱动
  const interceptorHooks = {
    requestResolved: undefined as ((config: unknown) => unknown) | undefined
  };
  instance.interceptors.request.use.mockImplementation((cb: unknown) => {
    interceptorHooks.requestResolved =
      cb as typeof interceptorHooks.requestResolved;
  });
  return {
    instanceMock: { instance, request },
    elMessageMock: vi.fn(),
    interceptorHooks
  };
});

const { refreshAccessTokenMock, redirectToLoginMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  redirectToLoginMock: vi.fn()
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => instanceMock.instance),
    isCancel: vi.fn(() => false)
  }
}));

vi.mock("@/utils/auth", () => ({
  formatToken: (token: string) => `Bearer ${token}`,
  getToken: vi.fn(() => ""),
  getRefreshToken: vi.fn(() => ""),
  remoteAccessToken: vi.fn(),
  removeToken: vi.fn(),
  setApiLanguage: vi.fn(),
  setToken: vi.fn()
}));

vi.mock("@/utils/message", () => ({
  message: elMessageMock
}));

vi.mock("@/utils/captchaSignal/env", () => ({
  getCaptchaFingerprint: () => "test-fp"
}));

vi.mock("../progress", () => ({
  default: { start: vi.fn(), done: vi.fn() }
}));

vi.mock("@pureadmin/utils", () => ({
  buildUUID: vi.fn(),
  downloadByData: vi.fn()
}));

vi.mock("./refreshToken", () => ({
  refreshAccessToken: refreshAccessTokenMock
}));

vi.mock("./redirect", () => ({
  redirectToLogin: redirectToLoginMock,
  redirectToModuleDisabled: vi.fn()
}));

import { getRefreshToken, removeToken } from "@/utils/auth";
// 引入即注册拦截器（请求拦截器由上方 mock 捕获）
import "./index";

describe("PureHttp 刷新失败反馈", () => {
  beforeEach(() => {
    elMessageMock.mockClear();
    redirectToLoginMock.mockClear();
    vi.mocked(removeToken).mockClear();
    refreshAccessTokenMock.mockReset();
  });

  /** 无 access、有 refresh 的请求：触发刷新并返回等待排队结果的 Promise */
  const triggerRefresh = () => {
    vi.mocked(getRefreshToken).mockReturnValueOnce("refresh-1");
    return interceptorHooks.requestResolved?.({
      method: "get",
      url: "/api/identity/user",
      headers: {}
    });
  };

  it("http 层已拒绝（401 响应体）：不重复提示，排队请求仍以失败收尾并跳登录", async () => {
    refreshAccessTokenMock.mockResolvedValueOnce({
      ok: false,
      detail: "令牌无效或已过期",
      error: { code: 40002, status: 401, detail: "令牌无效或已过期" }
    });

    const pending = triggerRefresh();
    await expect(pending).rejects.toMatchObject({ _refreshFailed: true });

    // 401 策略已在刷新请求自身收尾时提示业务 detail，这里不得再弹一次
    expect(elMessageMock).not.toHaveBeenCalled();
    expect(removeToken).toHaveBeenCalled();
    expect(redirectToLoginMock).toHaveBeenCalled();
  });

  it("HTTP 200 + 业务码失败：由拦截器补一次提示", async () => {
    refreshAccessTokenMock.mockResolvedValueOnce({
      ok: false,
      detail: "刷新凭证已失效"
    });

    const pending = triggerRefresh();
    await expect(pending).rejects.toMatchObject({ _refreshFailed: true });

    expect(elMessageMock).toHaveBeenCalledWith("刷新凭证已失效", {
      type: "warning"
    });
    expect(redirectToLoginMock).toHaveBeenCalled();
  });
});
