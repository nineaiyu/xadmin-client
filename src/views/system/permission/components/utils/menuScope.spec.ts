import { describe, expect, it } from "vitest";

import {
  buildScopeTree,
  countScopePermissions,
  countTreePermissions,
  expandScopePks,
  menuTypeOf,
  parentIdOf,
  type MenuScopeRow
} from "./menuScope";

/** 目录 → 页面 → 接口权限点（含空页面与对象形式的 parent，贴近接口返回） */
const rows: MenuScopeRow[] = [
  {
    pk: "dir",
    parent: null,
    menu_type: 0,
    meta: { title: "系统管理" },
    rank: 1
  },
  {
    pk: "page",
    parent: { pk: "dir" },
    menu_type: { value: 1 },
    meta: { title: "用户管理" },
    rank: 1
  },
  {
    pk: "p1",
    parent: "page",
    menu_type: 2,
    meta: { title: "查询用户" },
    method: "GET",
    path: "api/system/user$",
    rank: 1
  },
  {
    pk: "p2",
    parent: "page",
    menu_type: 2,
    meta: { title: "新建用户" },
    method: "POST",
    rank: 2
  },
  {
    pk: "empty",
    parent: "dir",
    menu_type: 1,
    meta: { title: "空页面" },
    rank: 2
  }
];

describe("menuScope 生效范围树与展开", () => {
  it("menuTypeOf / parentIdOf：兼容数字与 labeled 对象、字符串与对象父级", () => {
    expect(menuTypeOf(rows[1])).toBe(1);
    expect(menuTypeOf(rows[2])).toBe(2);
    expect(parentIdOf(rows[1])).toBe("dir");
    expect(parentIdOf(rows[2])).toBe("page");
    expect(parentIdOf(rows[0])).toBeNull();
  });

  it("expandScopePks：页面/目录展开为接口权限点，去重且忽略空页面", () => {
    expect(expandScopePks(rows, ["page"])).toEqual(["p1", "p2"]);
    expect(expandScopePks(rows, ["dir"])).toEqual(["p1", "p2"]);
    expect(expandScopePks(rows, ["p1", "page"])).toEqual(["p1", "p2"]);
    expect(expandScopePks(rows, ["empty"])).toEqual([]);
    expect(expandScopePks(rows, [])).toEqual([]);
  });

  it("countScopePermissions：统计实际生效接口数", () => {
    expect(countScopePermissions(rows, ["page"])).toBe(2);
    expect(countScopePermissions(rows, [])).toBe(0);
  });

  it("buildScopeTree：过滤无接口的页面，计数字段带出接口数量", () => {
    const tree = buildScopeTree(rows);
    expect(tree.map(node => node.pk)).toEqual(["dir"]);
    expect(tree[0].permissionCount).toBe(2);
    expect(tree[0].children?.map(node => node.pk)).toEqual(["page"]);
    expect(tree[0].children?.[0].children?.map(node => node.pk)).toEqual([
      "p1",
      "p2"
    ]);
    expect(tree[0].children?.[0].children?.[0].method).toBe("GET");
    expect(countTreePermissions(tree)).toBe(2);
  });

  it("buildScopeTree：同级节点按 rank 排序", () => {
    const tree = buildScopeTree([
      { pk: "b", parent: null, menu_type: 2, meta: { title: "B" }, rank: 2 },
      { pk: "a", parent: null, menu_type: 2, meta: { title: "A" }, rank: 1 }
    ]);
    expect(tree.map(node => node.pk)).toEqual(["a", "b"]);
  });
});
