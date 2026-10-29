import { describe, expect, it } from "vitest";

import {
  buildPermissionTreeIndex,
  menuDescendants,
  nodeKind,
  nodeKey
} from "../utils/permissionTree";

const node = (
  pk: number | string,
  menuType: number,
  children: unknown[] = []
) => ({ pk, menu_type: menuType, name: String(pk), children }) as never;

describe("权限树索引推导", () => {
  it("目录 / 菜单 / 权限点分类与父子链", () => {
    const tree = [
      node(1, 0, [node(2, 1, [node(3, 2)]), node(4, 2)]),
      node(5, 1)
    ];
    const index = buildPermissionTreeIndex(tree);
    expect(index.counts).toEqual({
      directory: 1,
      menu: 2,
      permission: 2,
      field: 0
    });
    expect(index.parentMap.get("2")).toBe("1");
    expect(index.parentMap.get("3")).toBe("2");
    expect(menuDescendants(index, "1").sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("字段合成键与字段组不进入菜单计数", () => {
    const tree = [node(1, 1, [node("+10", 2, [node("1+10", 2)])])];
    const index = buildPermissionTreeIndex(tree);
    expect(index.fieldGroupKeys).toEqual(["+10"]);
    expect(index.fieldKeys).toEqual(["1+10"]);
    expect(index.counts.menu).toBe(1);
    expect(index.counts.field).toBe(1);
    expect(nodeKind(node("1+10", 2))).toBe("field");
  });

  it("nodeKey 统一字符串化，空主键返回空串", () => {
    expect(nodeKey({ pk: 9 } as never)).toBe("9");
    expect(nodeKey({} as never)).toBe("");
  });
});
