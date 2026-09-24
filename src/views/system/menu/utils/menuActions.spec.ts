import { describe, expect, it, vi } from "vitest";

import { MenuChoices } from "@/views/system/constants";
import { buildNodeActions, type MenuActionContext } from "./menuActions";
import { normalizeMenuRow } from "./normalize";
import type { MenuAuths, MenuRow } from "./types";

vi.mock("@/plugins/i18n", () => ({
  transformI18n: (value: string) => value
}));

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

const t = ((key: string) => key) as unknown as MenuActionContext["t"];

const context = (auth: MenuAuths): MenuActionContext => ({
  t,
  auth,
  openEdit: vi.fn(),
  openCreate: vi.fn(),
  openPermission: vi.fn(),
  openRename: vi.fn(),
  openClone: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
  toggleActive: vi.fn()
});

const row = (menuType: number, isActive = true): MenuRow =>
  ({
    ...normalizeMenuRow({
      pk: 1,
      name: "SystemUser",
      path: "/system/user/index",
      menu_type: menuType,
      is_active: isActive,
      meta: { title: "用户管理" }
    })
  }) as MenuRow;

const fullAuth: MenuAuths = {
  create: true,
  destroy: true,
  partialUpdate: true,
  rank: true,
  permissions: true
};

const codes = (auth: MenuAuths, menuType: number, isActive = true) =>
  buildNodeActions(row(menuType, isActive), context(auth)).map(
    item => item.code
  );

describe("buildNodeActions", () => {
  it("全权限菜单节点：编辑/加子级/权限码/克隆/重命名/复制/排序/停用/删除", () => {
    expect(codes(fullAuth, MenuChoices.MENU)).toEqual([
      "edit",
      "addChild",
      "permissions",
      "clone",
      "rename",
      "copyPath",
      "moveUp",
      "moveDown",
      "moveTop",
      "toggleActive",
      "delete"
    ]);
  });

  it("权限点节点不提供加子级与权限码，但提供复制权限标识", () => {
    const list = codes(fullAuth, MenuChoices.PERMISSION);
    expect(list).not.toContain("addChild");
    expect(list).not.toContain("permissions");
    expect(list).toContain("copyCode");
  });

  it("无权限时动作整体收敛（只读账号保留复制）", () => {
    const list = codes({}, MenuChoices.MENU);
    expect(list).toEqual(["copyPath"]);
  });

  it("无排序权限时不出现上移/下移/置顶", () => {
    const list = codes({ rank: false, partialUpdate: true }, MenuChoices.MENU);
    expect(list).not.toContain("moveUp");
    expect(list).toContain("toggleActive");
    expect(list).not.toContain("delete");
  });

  it("停用节点给出「启用」动作（文案随状态切换）", () => {
    const actions = buildNodeActions(
      row(MenuChoices.MENU, false),
      context(fullAuth)
    );
    const toggle = actions.find(item => item.code === "toggleActive");
    expect(toggle?.label).toBe("systemMenu.action.enable");
  });

  it("删除为危险动作且与上方动作分组", () => {
    const actions = buildNodeActions(row(MenuChoices.MENU), context(fullAuth));
    const remove = actions.find(item => item.code === "delete");
    expect(remove?.danger).toBe(true);
    expect(actions.find(item => item.code === "toggleActive")?.divided).toBe(
      true
    );
  });

  it("动作执行器绑定当前行（闭包不串行）", () => {
    const ctx = context(fullAuth);
    const target = row(MenuChoices.MENU);
    const actions = buildNodeActions(target, ctx);
    actions.find(item => item.code === "edit")?.run();
    expect(ctx.openEdit).toHaveBeenCalledWith(target);
    actions.find(item => item.code === "moveUp")?.run();
    expect(ctx.move).toHaveBeenCalledWith(target, "up");
    actions.find(item => item.code === "delete")?.run();
    expect(ctx.remove).toHaveBeenCalledWith(target);
  });
});
