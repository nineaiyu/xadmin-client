import { describe, expect, it } from "vitest";

import { MenuChoices } from "@/views/system/constants";
import {
  ancestorChain,
  buildMenuTree,
  buildRowIndex,
  emptyFormModel,
  flattenMenuTree,
  normalizeMenuRow,
  rowPathText,
  toFormModel,
  toPayload
} from "./normalize";

/** 接口原始行样本：对象化字段（menu_type/method/parent/model）与真实响应同形 */
const RAW_DIRECTORY = {
  pk: 1,
  name: "system",
  path: "/system",
  menu_type: { value: MenuChoices.DIRECTORY, label: "目录" },
  parent: null,
  is_active: true,
  rank: 1,
  meta: { title: "系统管理", icon: "ep:setting" }
};

const RAW_MENU = {
  pk: 2,
  name: "SystemUser",
  path: "/system/user/index",
  component: "system/user/index",
  menu_type: { value: MenuChoices.MENU, label: "菜单" },
  parent: { pk: 1, name: "system" },
  is_active: true,
  rank: 2,
  meta: { title: "用户管理" }
};

const RAW_PERMISSION = {
  pk: 3,
  name: "list:SystemUser",
  path: "api/system/user$",
  method: { value: "GET", label: "GET" },
  menu_type: { value: MenuChoices.PERMISSION, label: "权限" },
  parent: 2,
  is_active: false,
  rank: 3,
  model: [{ pk: "m1", name: "userinfo", label: "用户信息" }],
  meta: { title: "U-用户列表" }
};

const buildTree = () =>
  buildMenuTree(
    [RAW_DIRECTORY, RAW_MENU, RAW_PERMISSION].map(row =>
      normalizeMenuRow(row as unknown as Record<string, unknown>)
    )
  );

describe("normalizeMenuRow", () => {
  it("对象化字段取标量：类型/父级/请求方法", () => {
    const row = normalizeMenuRow(
      RAW_PERMISSION as unknown as Record<string, unknown>
    );
    expect(row.menuType).toBe(MenuChoices.PERMISSION);
    expect(row.parent).toBe(2);
    expect(row.method).toBe("GET");
    expect(row.isActive).toBe(false);
  });

  it("父级为对象时取 pk，关联模型取 pk 列表", () => {
    const row = normalizeMenuRow(
      RAW_PERMISSION as unknown as Record<string, unknown>
    );
    expect(row.modelPks).toEqual(["m1"]);
    const menu = normalizeMenuRow(
      RAW_MENU as unknown as Record<string, unknown>
    );
    expect(menu.parent).toBe(1);
    expect(menu.modelPks).toEqual([]);
  });

  it("meta 缺省字段补默认值（水印默认关闭）", () => {
    const row = normalizeMenuRow({
      pk: 9,
      name: "x",
      path: "/x",
      menu_type: 0,
      is_active: true,
      meta: { title: "X" }
    });
    expect(row.meta.watermark).toBe(false);
    expect(row.meta.is_show_menu).toBe(true);
    expect(row.meta.is_keepalive).toBe(true);
  });
});

describe("buildMenuTree", () => {
  it("装配层级并补齐后代计数（含停用后代数）", () => {
    const tree = buildTree();
    expect(tree).toHaveLength(1);
    const [root] = tree;
    expect(root.depth).toBe(1);
    expect(root.directCount).toBe(1);
    expect(root.descendantCount).toBe(2);
    expect(root.inactiveDescendantCount).toBe(1);
    expect(root.children[0].meta.title).toBe("用户管理");
    expect(root.children[0].depth).toBe(2);
    expect(root.children[0].children[0].depth).toBe(3);
  });

  it("同层按 rank 排序", () => {
    const rows = [
      {
        pk: 10,
        parent: null,
        rank: 5,
        name: "b",
        path: "/b",
        menu_type: 0,
        meta: {}
      },
      {
        pk: 11,
        parent: null,
        rank: 1,
        name: "a",
        path: "/a",
        menu_type: 0,
        meta: {}
      }
    ].map(row => normalizeMenuRow(row as unknown as Record<string, unknown>));
    const tree = buildMenuTree(rows);
    expect(tree.map(item => item.name)).toEqual(["a", "b"]);
  });

  it("可重复装配且结果一致（幂等）", () => {
    const rows = [RAW_DIRECTORY, RAW_MENU].map(row =>
      normalizeMenuRow(row as unknown as Record<string, unknown>)
    );
    const first = buildMenuTree(rows);
    const second = buildMenuTree(rows);
    expect(second).toHaveLength(1);
    expect(first[0].children).toHaveLength(second[0].children.length);
    expect(first[0].descendantCount).toBe(second[0].descendantCount);
  });

  it("父级缺失或成环时按根节点处理（不丢节点、不递归爆栈）", () => {
    const rows = [
      {
        pk: 20,
        parent: 999,
        name: "orphan",
        path: "/o",
        menu_type: 0,
        meta: {}
      },
      {
        pk: 21,
        parent: 22,
        name: "loop-a",
        path: "/a",
        menu_type: 0,
        meta: {}
      },
      { pk: 22, parent: 21, name: "loop-b", path: "/b", menu_type: 0, meta: {} }
    ].map(row => normalizeMenuRow(row as unknown as Record<string, unknown>));
    const tree = buildMenuTree(rows);
    expect(flattenMenuTree(tree)).toHaveLength(3);
  });
});

describe("行派生能力", () => {
  it("flattenMenuTree 前序遍历与 buildRowIndex 索引", () => {
    const tree = buildTree();
    expect(flattenMenuTree(tree).map(row => row.pk)).toEqual([1, 2, 3]);
    const { byPk, byParent } = buildRowIndex(tree);
    expect(byPk.get("3")?.meta.title).toBe("U-用户列表");
    expect(byParent.get("1")).toHaveLength(1);
    expect(byParent.get("")).toHaveLength(1);
  });

  it("ancestorChain 返回自身到根的链路", () => {
    const tree = buildTree();
    const { byPk } = buildRowIndex(tree);
    const chain = ancestorChain(byPk.get("3")!, byPk);
    expect(chain.map(row => row.pk)).toEqual([3, 2, 1]);
  });

  it("rowPathText：权限点带请求方法，其余只给路由", () => {
    const tree = buildTree();
    const flat = flattenMenuTree(tree);
    expect(rowPathText(flat[2])).toBe("GET api/system/user$");
    expect(rowPathText(flat[1])).toBe("/system/user/index");
  });
});

describe("表单模型与提交载荷", () => {
  it("toFormModel 还原可编辑字段（含 meta 与关联模型）", () => {
    const tree = buildTree();
    const flat = flattenMenuTree(tree);
    const model = toFormModel(flat[2]);
    expect(model.pk).toBe(3);
    expect(model.menuType).toBe(MenuChoices.PERMISSION);
    expect(model.method).toBe("GET");
    expect(model.model).toEqual(["m1"]);
    expect(model.isActive).toBe(false);
  });

  it("权限点载荷保留 method/model，菜单载荷清空 method/model", () => {
    const permission = toPayload(
      emptyFormModel(null, MenuChoices.PERMISSION)
    ) as {
      method: unknown;
      model: unknown;
      meta: { transition_enter: string };
    };
    expect(permission.method).toBeNull();
    expect(permission.model).toEqual([]);

    const model = emptyFormModel(null, MenuChoices.MENU);
    model.method = "POST";
    model.model = ["m1"];
    const payload = toPayload(model) as {
      method: unknown;
      model: unknown;
      meta: { transition_enter: string };
    };
    expect(payload.method).toBeNull();
    expect(payload.model).toEqual([]);
    expect(payload.meta.transition_enter).toBe("");
  });

  it("上级节点为空串时提交 null（顶级菜单）", () => {
    const payload = toPayload(emptyFormModel(null, MenuChoices.DIRECTORY)) as {
      parent: unknown;
    };
    expect(payload.parent).toBeNull();
  });
});
