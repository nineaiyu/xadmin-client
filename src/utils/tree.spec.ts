import { describe, expect, it } from "vitest";

import {
  appendFieldByUniqueId,
  buildHierarchyTree,
  deleteChildren,
  extractPathList,
  getNodeByUniqueId,
  handleTree,
  type TreeHelperNode
} from "./tree";

describe("extractPathList", () => {
  it("提取顶层节点的 uniqueId", () => {
    const tree = [
      { uniqueId: "a", children: [{ uniqueId: "a-1" }] },
      { uniqueId: "b" }
    ];
    expect(extractPathList(tree)).toEqual(["a", "b"]);
  });

  it("空树 / 非数组返回空数组", () => {
    expect(extractPathList([])).toEqual([]);
    expect(extractPathList(null)).toEqual([]);
  });
});

describe("buildHierarchyTree", () => {
  it("为节点构建 id / parentId / pathList 层级", () => {
    const tree: TreeHelperNode[] = [
      { path: "dir" },
      { path: "dir2", children: [{ path: "child" }] }
    ];
    buildHierarchyTree(tree);
    expect(tree[0].id).toBe(0);
    expect(tree[0].parentId).toBeNull();
    expect(tree[0].pathList).toEqual([0]);
    expect(tree[1].children?.[0].parentId).toBe(1);
    expect(tree[1].children?.[0].pathList).toEqual([1, 0]);
  });
});

describe("deleteChildren", () => {
  it("children 长度为 1 时删除 children 并生成 uniqueId", () => {
    const tree: TreeHelperNode[] = [
      { uniqueId: "a", children: [{ uniqueId: "a-1" }] }
    ];
    deleteChildren(tree);
    expect(tree[0].children).toBeUndefined();
    expect(tree[0].parentId).toBeNull();
    expect(tree[0].uniqueId).toBe(0);
  });

  it("children 多于 1 时保留 children", () => {
    const tree = [
      { uniqueId: "a", children: [{ uniqueId: 1 }, { uniqueId: 2 }] }
    ];
    deleteChildren(tree);
    expect(tree[0].children).toBeDefined();
  });
});

describe("getNodeByUniqueId", () => {
  it("查找到嵌套节点的信息", () => {
    const tree: TreeHelperNode[] = [
      hNode("root1", [
        hNode("sub-1", [hNode("leaf-1", null, { uniqueId: "leaf-1" })])
      ]),
      hNode("root2")
    ];
    const node = getNodeByUniqueId(tree, "leaf-1");
    expect(node?.uniqueId).toBe("leaf-1");
  });

  function hNode(
    uniqueId: string,
    children: TreeHelperNode[] | null = null,
    extra?: Partial<TreeHelperNode>
  ): TreeHelperNode {
    return { uniqueId, children, ...extra };
  }
});

describe("appendFieldByUniqueId", () => {
  it("向匹配节点追加字段，不影响其他节点", () => {
    const tree: TreeHelperNode[] = [{ uniqueId: "a" }, { uniqueId: "b" }];
    appendFieldByUniqueId(tree, "a", { title: "A", active: true });
    expect(tree[0]).toMatchObject({ uniqueId: "a", title: "A", active: true });
    expect(tree[1]).not.toHaveProperty("title");
  });

  it("递归命中嵌套节点", () => {
    const tree: TreeHelperNode[] = [
      { uniqueId: "a", children: [{ uniqueId: "a-1" }] }
    ];
    appendFieldByUniqueId(tree, "a-1", { extra: 1 });
    expect(tree[0].children?.[0]).toHaveProperty("extra", 1);
  });
});

describe("handleTree 构造树型结构", () => {
  const flat = [
    { pk: 1, name: "根", parent: null },
    { pk: 2, name: "子1", parent: { pk: 1 } },
    { pk: 3, name: "子2", parent: 1 },
    { pk: 4, name: "孙", parent: { pk: 2 } }
  ];

  it("按 parent 关联生成 children 树", () => {
    const tree = handleTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].pk).toBe(1);
    const rootChildren = tree[0].children ?? [];
    expect(rootChildren).toHaveLength(2);
    const child1 = rootChildren.find(c => c.pk === 2);
    expect(child1?.children).toHaveLength(1);
    expect(child1?.children?.[0].pk).toBe(4);
  });

  it("支持自定义 id / parentId / children 字段名", () => {
    const data = [
      { id: "a", pid: null },
      { id: "b", pid: "a" }
    ];
    const tree = handleTree(data, "id", "pid", "kids");
    // 自定义 children 字段名（kids）不在默认契约里，走一次边界断言
    const root = tree[0] as TreeHelperNode & {
      kids?: Array<TreeHelperNode & { id: string }>;
    };
    expect(root.id).toBe("a");
    expect(root.kids?.[0].id).toBe("b");
  });

  it("空数组返回空树", () => {
    expect(handleTree([])).toEqual([]);
  });
});
