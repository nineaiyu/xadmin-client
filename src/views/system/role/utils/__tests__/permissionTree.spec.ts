import { describe, expect, it } from "vitest";

import {
  buildPermissionTreeIndex,
  cascadeSelection,
  collectSelectionPayload,
  computeNodeStatusMap,
  computeSelectionStats,
  countFieldSelection,
  invertSelection,
  matchPermissionNode,
  menuAncestors,
  menuDescendants,
  nodeKind,
  normalizeSelection,
  splitHighlight,
  toggleMenuSelection,
  type PermissionTreeNode
} from "../permissionTree";

/**
 * 授权树样本：目录 A（菜单 a1 带两个权限点 + 字段分组，菜单 a2）、目录 B（菜单 b1）。
 * 字段分组键 `+f1` 与字段叶子键 `a1+f1` 的约定同 utils/treeKeys.ts。
 */
function buildTree(): PermissionTreeNode[] {
  return [
    {
      pk: "a",
      name: "System",
      path: "/system",
      menu_type: { value: 0 },
      meta: { title: "系统管理" },
      children: [
        {
          pk: "a1",
          name: "SystemUser",
          path: "/system/user/index",
          menu_type: { value: 1 },
          meta: { title: "用户管理" },
          children: [
            {
              pk: "a1-1",
              name: "list:SystemUser",
              path: "api/system/user",
              menu_type: { value: 2 },
              meta: { title: "查看用户" }
            },
            {
              pk: "a1-2",
              name: "create:SystemUser",
              path: "api/system/user",
              menu_type: { value: 2 },
              meta: { title: "新建用户" }
            },
            {
              pk: "+f1",
              label: "用户信息",
              name: "system.userinfo",
              children: [
                { pk: "a1+f1", label: "用户名", name: "username" },
                { pk: "a1+f2", label: "手机号", name: "phone" }
              ]
            }
          ]
        },
        {
          pk: "a2",
          name: "SystemRole",
          path: "/system/role/index",
          menu_type: { value: 1 },
          meta: { title: "角色管理" }
        }
      ]
    },
    {
      pk: "b",
      name: "Ops",
      path: "/ops",
      menu_type: { value: 0 },
      meta: { title: "运维管理" },
      children: [
        {
          pk: "b1",
          name: "OpsServer",
          path: "/ops/server/index",
          menu_type: { value: 1 },
          meta: { title: "服务器监控" }
        }
      ]
    }
  ];
}

describe("buildPermissionTreeIndex", () => {
  it("按深度优先先序收集菜单键，字段合成节点单独归类", () => {
    const index = buildPermissionTreeIndex(buildTree());
    expect(index.menuKeys).toEqual([
      "a",
      "a1",
      "a1-1",
      "a1-2",
      "a2",
      "b",
      "b1"
    ]);
    expect(index.fieldGroupKeys).toEqual(["+f1"]);
    expect(index.fieldKeys).toEqual(["a1+f1", "a1+f2"]);
    expect(index.counts).toEqual({
      directory: 2,
      menu: 3,
      permission: 2,
      field: 2
    });
  });

  it("父子关系只记录真实菜单节点（字段分组不算菜单子级）", () => {
    const index = buildPermissionTreeIndex(buildTree());
    expect(index.childrenMap.get("a1")).toEqual(["a1-1", "a1-2"]);
    expect(index.childrenMap.get("a")).toEqual(["a1", "a2"]);
    expect(index.parentMap.get("a1-1")).toBe("a1");
    expect(index.parentMap.has("+f1")).toBe(false);
  });

  it("识别节点类型", () => {
    const index = buildPermissionTreeIndex(buildTree());
    expect(nodeKind(index.nodeMap.get("a") as PermissionTreeNode)).toBe(
      "directory"
    );
    expect(nodeKind(index.nodeMap.get("a1") as PermissionTreeNode)).toBe(
      "menu"
    );
    expect(nodeKind(index.nodeMap.get("a1-1") as PermissionTreeNode)).toBe(
      "permission"
    );
    expect(nodeKind(index.nodeMap.get("+f1") as PermissionTreeNode)).toBe(
      "fieldGroup"
    );
    expect(nodeKind(index.nodeMap.get("a1+f1") as PermissionTreeNode)).toBe(
      "field"
    );
  });
});

describe("menuDescendants / menuAncestors", () => {
  it("后代含自身，祖先由近及远", () => {
    const index = buildPermissionTreeIndex(buildTree());
    expect(menuDescendants(index, "a1").sort()).toEqual(["a1", "a1-1", "a1-2"]);
    expect(menuAncestors(index, "a1-1")).toEqual(["a1", "a"]);
    expect(menuAncestors(index, "a")).toEqual([]);
  });
});

describe("cascadeSelection", () => {
  const index = buildPermissionTreeIndex(buildTree());

  it("选中父节点：自身、全部后代与祖先目录选中", () => {
    const next = cascadeSelection(index, "a1", true, []);
    expect([...next].sort()).toEqual(["a", "a1", "a1-1", "a1-2"]);
  });

  it("选中子节点：祖先一并选中（授权链完整）", () => {
    const next = cascadeSelection(index, "a1-1", true, []);
    expect([...next].sort()).toEqual(["a", "a1", "a1-1"]);
  });

  it("取消子节点：仍有选中兄弟时父链保留，全取消后父链一并移除", () => {
    const both = cascadeSelection(index, "a1", true, []);
    const one = cascadeSelection(index, "a1-2", false, both);
    expect([...one].sort()).toEqual(["a", "a1", "a1-1"]);
    const none = cascadeSelection(index, "a1-1", false, one);
    expect([...none]).toEqual([]);
  });

  it("取消父节点：后代一并取消", () => {
    const all = cascadeSelection(index, "a", true, []);
    expect(all.size).toBe(5);
    const cleared = cascadeSelection(index, "a", false, all);
    expect([...cleared]).toEqual([]);
  });

  it("字段合成节点与菜单联动互不影响", () => {
    const withField = cascadeSelection(index, "a1-1", true, ["a1+f1"]);
    expect(withField.has("a1+f1")).toBe(true);
    const cleared = cascadeSelection(index, "a1-1", false, withField);
    expect(cleared.has("a1+f1")).toBe(true);
    expect(cleared.size).toBe(1);
  });
});

describe("toggleMenuSelection", () => {
  const index = buildPermissionTreeIndex(buildTree());

  it("全选覆盖全部菜单节点，字段勾选保持不动", () => {
    const next = toggleMenuSelection(index, true, ["a1+f1"]);
    expect([...next].sort()).toEqual([
      "a",
      "a1",
      "a1+f1",
      "a1-1",
      "a1-2",
      "a2",
      "b",
      "b1"
    ]);
  });

  it("清空只清菜单节点", () => {
    const next = toggleMenuSelection(index, false, ["a", "a1", "a1+f1"]);
    expect([...next]).toEqual(["a1+f1"]);
  });
});

describe("invertSelection", () => {
  const index = buildPermissionTreeIndex(buildTree());

  it("全量反选：原选中清空，原未选中选中，父链保持一致", () => {
    const origin = cascadeSelection(index, "a1", true, []);
    const next = invertSelection(index, origin);
    expect(next.has("a1")).toBe(false);
    expect(next.has("a1-1")).toBe(false);
    expect([...next].sort()).toEqual(["a", "a2", "b", "b1"]);
  });

  it("搜索作用域反选：只影响命中节点及其后代", () => {
    const origin = cascadeSelection(index, "b", true, []);
    const next = invertSelection(index, origin, ["a1"]);
    // b 分支保持选中，a1 分支被反选选中并补齐父链
    expect([...next].sort()).toEqual(["a", "a1", "a1-1", "a1-2", "b", "b1"]);
  });
});

describe("normalizeSelection", () => {
  const index = buildPermissionTreeIndex(buildTree());

  it("补齐有选中子节点的父链，剔除无子级支撑的父节点", () => {
    const next = normalizeSelection(index, ["a1-1", "b", "a1+f1"]);
    // b 虽被传入，但其子级 b1 未选中，规范化后剔除
    expect([...next].sort()).toEqual(["a", "a1", "a1+f1", "a1-1"]);
  });
});

describe("computeNodeStatusMap / computeSelectionStats", () => {
  const index = buildPermissionTreeIndex(buildTree());

  it("三态标识：已选 / 部分选中 / 未选", () => {
    const selection = cascadeSelection(index, "a1-1", true, []);
    const statuses = computeNodeStatusMap(index, selection);
    expect(statuses.get("a")).toBe("partial");
    expect(statuses.get("a1")).toBe("partial");
    expect(statuses.get("a1-1")).toBe("checked");
    expect(statuses.get("a1-2")).toBe("unchecked");
    expect(statuses.get("b")).toBe("unchecked");
  });

  it("子树全部选中后父节点转为已选", () => {
    const selection = cascadeSelection(index, "a1", true, []);
    const statuses = computeNodeStatusMap(index, selection);
    expect(statuses.get("a1")).toBe("checked");
    expect(statuses.get("a")).toBe("partial");
  });

  it("分类统计与部分选中计数", () => {
    const selection = cascadeSelection(index, "a1-1", true, ["a1+f1"]);
    const stats = computeSelectionStats(index, selection);
    expect(stats.checked).toBe(3);
    expect(stats.total).toBe(7);
    expect(stats.directory).toEqual({ checked: 1, total: 2 });
    expect(stats.menu).toEqual({ checked: 1, total: 3 });
    expect(stats.permission).toEqual({ checked: 1, total: 2 });
    expect(stats.field).toEqual({ checked: 1, total: 2 });
    expect(stats.partial).toBe(2);
  });
});

describe("countFieldSelection", () => {
  it("统计字段分组下的勾选进度", () => {
    const index = buildPermissionTreeIndex(buildTree());
    const group = index.nodeMap.get("+f1") as PermissionTreeNode;
    expect(countFieldSelection(group, ["a1+f1"])).toEqual({
      checked: 1,
      total: 2
    });
    expect(countFieldSelection(group, [])).toEqual({ checked: 0, total: 2 });
  });
});

describe("collectSelectionPayload", () => {
  it("拆分菜单键与字段权限字典", () => {
    const payload = collectSelectionPayload([
      "a",
      "a1",
      "a1+f1",
      "a1+f2",
      "+f1"
    ]);
    expect(payload.menu).toEqual(["a", "a1"]);
    expect(payload.fields).toEqual({ a1: ["f1", "f2"] });
  });

  it("忽略字段分组键（仅展示，不计入授权）", () => {
    expect(collectSelectionPayload(["+f1"])).toEqual({ menu: [], fields: {} });
  });
});

describe("matchPermissionNode", () => {
  it("命中标题 / 权限码 / 路径 / 字段标签，大小写不敏感", () => {
    const node: PermissionTreeNode = {
      pk: "x",
      name: "list:SystemUser",
      path: "api/system/user",
      meta: { title: "用户管理" }
    };
    expect(matchPermissionNode(node, "用户")).toBe(true);
    expect(matchPermissionNode(node, "systemuser")).toBe(true);
    expect(matchPermissionNode(node, "API/SYSTEM")).toBe(true);
    expect(matchPermissionNode(node, "角色")).toBe(false);
    expect(matchPermissionNode(node, "  ")).toBe(true);
  });
});

describe("splitHighlight", () => {
  it("按命中片段切分文本", () => {
    expect(splitHighlight("用户管理", "用户")).toEqual([
      { text: "用户", hit: true },
      { text: "管理", hit: false }
    ]);
  });

  it("多处命中与无命中", () => {
    expect(splitHighlight("user-user", "user")).toEqual([
      { text: "user", hit: true },
      { text: "-", hit: false },
      { text: "user", hit: true }
    ]);
    expect(splitHighlight("角色管理", "用户")).toEqual([
      { text: "角色管理", hit: false }
    ]);
    expect(splitHighlight("", "用户")).toEqual([{ text: "", hit: false }]);
  });
});
