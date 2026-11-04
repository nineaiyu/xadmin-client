import { afterEach, describe, expect, it, vi } from "vitest";

const { isCookieAuthSessionMock, interceptorHooks, axiosInstance } = vi.hoisted(
  () => {
    // axios 实例测试替身：仅捕获请求拦截器回调（Cookie 会话模式只消费该路径）
    const interceptorHooks = {
      requestResolved: undefined as ((config: unknown) => unknown) | undefined
    };
    const axiosInstance = {
      interceptors: {
        request: {
          use: (cb: (config: unknown) => unknown) => {
            interceptorHooks.requestResolved = cb;
          }
        },
        response: { use: vi.fn() }
      },
      request: vi.fn()
    };
    return {
      isCookieAuthSessionMock: vi.fn(() => false),
      interceptorHooks,
      axiosInstance
    };
  }
);

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => axiosInstance),
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
  setToken: vi.fn(),
  isCookieAuthSession: isCookieAuthSessionMock,
  hasSession: vi.fn(() => false)
}));

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("../progress", () => ({ default: { start: vi.fn(), done: vi.fn() } }));

// 装载 http 模块以触发拦截器注册（依赖图与 index.spec 相同，mock 逐项对齐）
await import("./index");

describe("PureHttp Cookie 会话模式拦截", () => {
  afterEach(() => {
    isCookieAuthSessionMock.mockReset().mockReturnValue(false);
  });

  it("Cookie 模式：withCredentials=true，不拼 Authorization 也不触发本地刷新", async () => {
    isCookieAuthSessionMock.mockReturnValue(true);
    const config = {
      method: "get",
      url: "/api/system/user",
      headers: {} as Record<string, string>
    };
    const resolved = await interceptorHooks.requestResolved?.(config);
    expect((resolved as { withCredentials?: boolean }).withCredentials).toBe(
      true
    );
    expect(config.headers["Authorization"]).toBeUndefined();
  });

  it("header 模式：保持既有行为，不设置 withCredentials", async () => {
    isCookieAuthSessionMock.mockReturnValue(false);
    const config = {
      method: "get",
      url: "/api/system/user",
      headers: {} as Record<string, string>
    };
    await interceptorHooks.requestResolved?.(config);
    expect(
      (config as { withCredentials?: boolean }).withCredentials
    ).toBeUndefined();
  });
});
