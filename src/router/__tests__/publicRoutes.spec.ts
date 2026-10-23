import { describe, expect, it } from "vitest";
import {
  GUEST_ONLY_ROUTE_PATHS,
  PUBLIC_ROUTE_PATHS,
  isGuestOnlyRoutePath,
  isPublicRoutePath
} from "../publicRoutes";

/**
 * 路由白名单守护：两张清单的语义不同，混用会让 OAuth 绑定/登录闭环断在守卫层。
 */
describe("路由白名单", () => {
  it("OAuth 回跳页未登录可达（code/state 即凭据）", () => {
    expect(isPublicRoutePath("/oauth/callback")).toBe(true);
    expect(isPublicRoutePath("/login")).toBe(true);
    expect(isPublicRoutePath("/invite/accept")).toBe(true);
  });

  it("OAuth 回跳页不属于「已登录保持原页」清单（绑定是已登录流程）", () => {
    expect(isGuestOnlyRoutePath("/oauth/callback")).toBe(false);
    expect(isGuestOnlyRoutePath("/login")).toBe(true);
    expect(isGuestOnlyRoutePath("/invite/accept")).toBe(true);
  });

  it("普通业务页不在白名单", () => {
    expect(isPublicRoutePath("/")).toBe(false);
    expect(isPublicRoutePath("/system/user")).toBe(false);
    expect(isPublicRoutePath("/oauth/authorize")).toBe(false);
  });

  it("guest-only 清单是 public 清单的子集", () => {
    for (const path of GUEST_ONLY_ROUTE_PATHS) {
      expect(PUBLIC_ROUTE_PATHS).toContain(path);
    }
  });
});
