import { describe, expect, it, vi } from "vitest";
import { createAccountPanes } from "./panes";

const PANE_KEYS = [
  "profile",
  "accountManagement",
  "mfa",
  "passkey",
  "oauthBindings",
  "accessToken",
  "preferences",
  "Notifications",
  "securityLog"
];

const t = (key: string) => key;

describe("createAccountPanes", () => {
  it("页签顺序与 key 集合稳定（侧栏渲染与 ?tab= 直达共用）", () => {
    const panes = createAccountPanes(t, () => true);

    expect(panes.map(pane => pane.key)).toEqual(PANE_KEYS);
    expect(panes.every(pane => pane.label && pane.component && pane.icon)).toBe(
      true
    );
  });

  it("个人可自管页签恒可用（不依赖菜单权限点）", () => {
    const panes = createAccountPanes(t, () => false);
    const alwaysOn = panes.filter(pane => pane.auth).map(pane => pane.key);

    expect(alwaysOn).toEqual([
      "profile",
      "mfa",
      "passkey",
      "oauthBindings",
      "accessToken",
      "preferences"
    ]);
  });

  it("权限门页签按 hasAuth 判定（无权限不渲染）", () => {
    const granted = createAccountPanes(t, () => true);
    const denied = createAccountPanes(t, () => false);

    expect(granted.map(pane => pane.key)).toEqual(PANE_KEYS);
    const deniedAuth = Object.fromEntries(
      denied.map(pane => [pane.key, pane.auth])
    );
    expect(deniedAuth["accountManagement"]).toBe(false);
    expect(deniedAuth["Notifications"]).toBe(false);
    expect(deniedAuth["securityLog"]).toBe(false);
  });

  it("账户管理页签是 resetPassword / bind 任一权限的并集", () => {
    const onlyBind = createAccountPanes(
      t,
      code => code === "bind:UserInfo"
    ).find(pane => pane.key === "accountManagement");
    const onlyReset = createAccountPanes(
      t,
      code => code === "resetPassword:UserInfo"
    ).find(pane => pane.key === "accountManagement");

    expect(onlyBind?.auth).toBe(true);
    expect(onlyReset?.auth).toBe(true);
  });

  it("每次调用返回新数组（computed 重算不共享可变引用）", () => {
    const a = createAccountPanes(t, () => true);
    const b = createAccountPanes(t, () => true);
    expect(a).not.toBe(b);
  });
});

describe("页签定义与 hasAuth 的参数面", () => {
  it("按预期权限码调用 hasAuth（无权限时两组并集权限码都要探测到）", () => {
    // 返回 false 避免 || 短路：resetPassword / bind 两个权限码都必须被探测
    const spy = vi.fn(() => false);

    createAccountPanes(t, spy);

    expect(spy).toHaveBeenCalledWith("resetPassword:UserInfo");
    expect(spy).toHaveBeenCalledWith("bind:UserInfo");
    expect(spy).toHaveBeenCalledWith("list:UserMsgSubscription");
    expect(spy).toHaveBeenCalledWith("list:UserLoginLog");
  });
});
