import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getItem: vi.fn()
  }
}));

vi.mock("@pureadmin/utils", () => ({
  storageLocal: () => storageMock
}));

vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: vi.fn(() => ({
    updateUserInfo: vi.fn()
  }))
}));

vi.mock("@/store/modules/loginPage", () => ({
  useLoginPageStoreHook: vi.fn(() => ({
    isRemembered: false,
    loginDay: 7
  }))
}));

vi.mock("@/config", () => ({
  responsiveStorageNameSpace: () => "responsive-namespace"
}));

vi.mock("responsive-storage", () => ({
  default: {
    getData: vi.fn(() => ({ locale: "zh" }))
  }
}));

import Cookies from "js-cookie";

import {
  formatToken,
  getRefreshToken,
  getToken,
  multipleTabsKey,
  remoteAccessToken,
  removeToken,
  setAccessToken,
  setRefreshToken,
  setToken,
  userKey
} from "./auth";

describe("token 工具", () => {
  beforeEach(() => {
    Object.keys(Cookies.get()).forEach(key => Cookies.remove(key));
    storageMock.setItem.mockClear();
    storageMock.removeItem.mockClear();
  });

  it("formatToken 增加 Bearer 前缀", () => {
    expect(formatToken("abc")).toBe("Bearer abc");
  });

  it("setAccessToken / getToken 存取往返", () => {
    setAccessToken("token-1");
    expect(getToken()).toBe("token-1");
  });

  it("setRefreshToken / getRefreshToken 存取往返", () => {
    setRefreshToken("refresh-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("setToken 按 token 生命周期写入 cookie", () => {
    setToken({
      access: "access-1",
      refresh: "refresh-1",
      access_token_lifetime: 100,
      refresh_token_lifetime: 200
    } as never);
    expect(getToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(Cookies.get(multipleTabsKey)).toBe("true");
  });

  it("removeToken 清空 token 与本地用户信息", () => {
    setAccessToken("token-1");
    setRefreshToken("refresh-1");
    storageMock.getItem.mockReturnValue({ username: "zhangsan" });
    removeToken();
    expect(getToken()).toBe("");
    expect(getRefreshToken()).toBeUndefined();
    expect(storageMock.removeItem).toHaveBeenCalledWith(userKey);
  });

  it("remoteAccessToken 仅移除访问 token", () => {
    setAccessToken("token-1");
    setRefreshToken("refresh-1");
    remoteAccessToken();
    expect(getToken()).toBe("");
    expect(getRefreshToken()).toBe("refresh-1");
  });
});

describe("认证 Cookie 的 Secure 属性", () => {
  const SECURE_ENV_KEY = "VITE_COOKIE_SECURE";

  /** 取最近一次 Cookies.set 的 attributes */
  function lastSetAttributes() {
    const calls = setSpy.mock.calls;
    return calls.length ? (calls[calls.length - 1][2] ?? {}) : {};
  }

  let setSpy: ReturnType<typeof vi.spyOn>;
  let originalSecureContext: boolean | undefined;

  beforeEach(() => {
    Object.keys(Cookies.get()).forEach(key => Cookies.remove(key));
    setSpy = vi.spyOn(Cookies, "set");
    originalSecureContext = window.isSecureContext;
  });

  afterEach(() => {
    setSpy.mockRestore();
    Object.defineProperty(window, "isSecureContext", {
      value: originalSecureContext,
      configurable: true
    });
    delete (import.meta.env as Record<string, unknown>)[SECURE_ENV_KEY];
  });

  function mockSecureContext(value: boolean) {
    Object.defineProperty(window, "isSecureContext", {
      value,
      configurable: true
    });
  }

  it("默认按页面上下文判定：安全上下文带上 Secure", () => {
    mockSecureContext(true);
    setAccessToken("token-secure");
    expect(lastSetAttributes().secure).toBe(true);
  });

  it("默认按页面上下文判定：非安全上下文（内网 HTTP）不带 Secure", () => {
    // 内网 http://<IP> 部署：Secure Cookie 会被浏览器静默丢弃，
    // 导致「登录成功即未授权」，故此处必须收窄为不带 Secure
    mockSecureContext(false);
    setAccessToken("token-plain");
    expect(lastSetAttributes().secure).toBe(false);
  });

  it("构建期显式 VITE_COOKIE_SECURE=true 时强制带上 Secure", () => {
    // 覆盖场景：前端有 TLS 终结反代但未传 X-Forwarded-Proto，
    // isSecureContext 误判为 false，此时需显式强制
    (import.meta.env as Record<string, unknown>)[SECURE_ENV_KEY] = "true";
    mockSecureContext(false);
    setAccessToken("token-forced");
    expect(lastSetAttributes().secure).toBe(true);
  });

  it("构建期显式 VITE_COOKIE_SECURE=false 时强制关闭 Secure", () => {
    (import.meta.env as Record<string, unknown>)[SECURE_ENV_KEY] = "false";
    mockSecureContext(true);
    setAccessToken("token-forced-off");
    expect(lastSetAttributes().secure).toBe(false);
  });

  it("三种认证 Cookie 的 Secure 口径一致", () => {
    mockSecureContext(false);
    setToken({
      access: "access-1",
      refresh: "refresh-1",
      access_token_lifetime: 100,
      refresh_token_lifetime: 200
    } as never);
    const secureFlags = setSpy.mock.calls.map(
      (call: unknown[]) => (call[2] as { secure?: boolean } | undefined)?.secure
    );
    expect(secureFlags.length).toBeGreaterThanOrEqual(3);
    expect(new Set(secureFlags).size).toBe(1);
  });
});
