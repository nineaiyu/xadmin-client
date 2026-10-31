import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const authMock = vi.hoisted(() => ({
  getToken: vi.fn(() => "access-token"),
  getRefreshToken: vi.fn((): string | null => "refresh-token"),
  removeToken: vi.fn(),
  setToken: vi.fn(),
  userKey: "user-info"
}));

const routerMock = vi.hoisted(() => ({
  resetRouter: vi.fn(),
  push: vi.fn(() => Promise.resolve()),
  currentRoute: { value: { path: "/welcome", fullPath: "/welcome?x=1" } }
}));

vi.mock("@/utils/auth", () => authMock);
vi.mock("@/router", () => ({
  resetRouter: routerMock.resetRouter,
  router: {
    currentRoute: routerMock.currentRoute,
    push: routerMock.push
  }
}));

import { useUserStore } from "../user";

describe("user store 跨标签登出", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    authMock.getToken.mockReturnValue("access-token");
    authMock.getRefreshToken.mockReturnValue("refresh-token");
    authMock.removeToken.mockClear();
    routerMock.resetRouter.mockClear();
    routerMock.push.mockClear();
  });

  it("收到其他标签登出：清本地登录态并回到登录页（带回跳参数）", async () => {
    const store = useUserStore();
    store.SET_USERNAME("alice");
    store.SET_ROLES(["admin"]);
    await store.handleRemoteLogout();
    expect(authMock.removeToken).toHaveBeenCalledTimes(1);
    expect(store.username).toBe("");
    expect(store.roles).toEqual([]);
    expect(routerMock.resetRouter).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/welcome?x=1" }
    });
  });

  it("本标签已无 token 时忽略（避免重复跳转）", async () => {
    authMock.getToken.mockReturnValue("");
    authMock.getRefreshToken.mockReturnValue(null);
    const store = useUserStore();
    await store.handleRemoteLogout();
    expect(authMock.removeToken).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
