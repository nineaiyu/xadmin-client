import { beforeEach, describe, expect, it, vi } from "vitest";

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
    isRemembered: false,
    loginDay: 7,
    SET_AVATAR: vi.fn(),
    SET_USERNAME: vi.fn(),
    SET_NICKNAME: vi.fn(),
    SET_EMAIL: vi.fn(),
    SET_PHONE: vi.fn(),
    SET_ROLES: vi.fn()
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
    expect(getToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
    expect(storageMock.removeItem).toHaveBeenCalledWith(userKey);
  });

  it("remoteAccessToken 仅移除访问 token", () => {
    setAccessToken("token-1");
    setRefreshToken("refresh-1");
    remoteAccessToken();
    expect(getToken()).toBeUndefined();
    expect(getRefreshToken()).toBe("refresh-1");
  });
});
