import { describe, expect, it } from "vitest";

import type { menuType } from "@/layout/types";
import { findMenuByActivePath } from "../navPresentation";

/** 构造最小菜单节点：只关心 path / children 的层级关系 */
function menu(path: string, children: menuType[] = []): menuType {
  return { path, value: undefined, children };
}

describe("findMenuByActivePath", () => {
  it("按菜单树父子关系命中：目录路径与页面 URL 不同前缀（在线用户 / 账号安全）", () => {
    const logManagement = menu("/system/logs", [
      menu("/system/online/index"),
      menu("/system/logs/operation/index"),
      menu("/system/account-risk/index")
    ]);
    expect(
      findMenuByActivePath([logManagement], "/system/online/index")?.path
    ).toBe("/system/logs");
    expect(
      findMenuByActivePath([logManagement], "/system/account-risk/index")?.path
    ).toBe("/system/logs");
  });

  it("多级后代同样命中最近的窄列祖先", () => {
    const system = menu("/system", [
      menu("/system/logs", [menu("/system/online/index")])
    ]);
    expect(findMenuByActivePath([system], "/system/online/index")?.path).toBe(
      "/system"
    );
  });

  it("窄列项本身就是激活页面时精确命中", () => {
    const online = menu("/system/online/index");
    expect(findMenuByActivePath([online], "/system/online/index")?.path).toBe(
      "/system/online/index"
    );
  });

  it("菜单树未命中时回落到历史前缀匹配（兼容 activePath 指向树外页面）", () => {
    const logs = menu("/system/logs");
    expect(
      findMenuByActivePath([logs], "/system/logs/operation/index")?.path
    ).toBe("/system/logs");
  });

  it("无命中返回 null", () => {
    expect(
      findMenuByActivePath([menu("/system/logs")], "/settings/basic")
    ).toBeNull();
    expect(findMenuByActivePath([], "/system/online/index")).toBeNull();
  });
});
