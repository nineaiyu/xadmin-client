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
  getAuthTransport,
  getRefreshToken,
  getToken,
  hasSession,
  isCookieAuthSession,
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

describe("认证承载双模式（X-Auth-Mode 标记）", () => {
  beforeEach(() => {
    Object.keys(Cookies.get()).forEach(key => Cookies.remove(key));
  });

  it("标记缺失时默认 header 模式（旧版服务端兼容，不靠猜）", () => {
    expect(getAuthTransport()).toBe("header");
    expect(isCookieAuthSession()).toBe(false);
  });

  it("标记为 cookie 时进入 Cookie 会话模式", () => {
    Cookies.set("X-Auth-Mode", "cookie");
    expect(getAuthTransport()).toBe("cookie");
    expect(isCookieAuthSession()).toBe(true);
  });

  it("Cookie 模式 setToken：不写 token Cookie，清遗留可读 Cookie，仍写会话标记", () => {
    // 模拟 header 模式遗留的可读 token（服务端翻开关前的旧会话残留）
    Cookies.set("X-Token", "legacy-access");
    Cookies.set("X-Refresh-Token", "legacy-refresh");
    Cookies.set("X-Auth-Mode", "cookie");
    setToken({
      access: "",
      refresh: "",
      access_token_lifetime: 100,
      refresh_token_lifetime: 200
    } as never);
    // token Cookie：既没写入新值，遗留可读值也被清掉（XSS 读不到）
    expect(getToken()).toBe("");
    expect(getRefreshToken()).toBeUndefined();
    // multiple-tabs 会话标记照常维护（路由守卫 / 跨标签登出的判定依据）
    expect(Cookies.get(multipleTabsKey)).toBe("true");
  });

  it("header 模式 setToken 行为不变：照常写 token Cookie", () => {
    setToken({
      access: "access-1",
      refresh: "refresh-1",
      access_token_lifetime: 100,
      refresh_token_lifetime: 200
    } as never);
    expect(getToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("hasSession：header 模式要求标记 + refresh；cookie 模式只看标记", () => {
    // header 模式：无 refresh 不算登录
    Cookies.set(multipleTabsKey, "true");
    expect(hasSession()).toBe(false);
    Cookies.set("X-Refresh-Token", "refresh-1");
    expect(hasSession()).toBe(true);
    // cookie 模式：refresh 不可读，multiple-tabs 即会话判据
    Cookies.set("X-Auth-Mode", "cookie");
    Cookies.remove("X-Refresh-Token");
    expect(hasSession()).toBe(true);
    // 标记清空（登出）后无会话
    Cookies.remove(multipleTabsKey);
    expect(hasSession()).toBe(false);
  });

  it("removeToken 同步清除模式标记（同标签立即生效；HttpOnly token 由登出接口清理）", () => {
    Cookies.set("X-Auth-Mode", "cookie");
    Cookies.set(multipleTabsKey, "true");
    removeToken();
    expect(getAuthTransport()).toBe("header");
    expect(Cookies.get(multipleTabsKey)).toBeUndefined();
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
