import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 角色授权树数据源（useRoleMenuTree）单测。
 *
 * 核心回归：菜单树先行回填——字段权限缺失（无 list:SystemModelLabelField）
 * 或字段接口失败时只损失注入的字段节点，整树不再空白。
 */

const { hasAuthMock, fetchAllRowsMock, messageMock } = vi.hoisted(() => ({
  hasAuthMock: vi.fn(),
  fetchAllRowsMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: messageMock }));
vi.mock("@/router/utils", () => ({ hasAuth: hasAuthMock }));
vi.mock("@/utils/metaCache", () => ({
  META_KEYS: { menu: "menu" },
  fetchMetaList: (_key: string, fetcher: () => Promise<unknown>) => fetcher()
}));
vi.mock("@/api/system/menu", () => ({ menuApi: { list: Symbol("menuApi") } }));
vi.mock("@/api/system/field", () => ({
  modelLabelFieldApi: { list: Symbol("fieldApi") }
}));
vi.mock("@/utils/fetchAllRows", () => ({ fetchAllRows: fetchAllRowsMock }));

import { useRoleMenuTree } from "../useRoleMenuTree";
import { menuApi } from "@/api/system/menu";
import { modelLabelFieldApi } from "@/api/system/field";
import type { PermissionTreeNode } from "../permissionTree";

const MENU_ROWS = [
  { pk: "m1", name: "系统管理", parent: null },
  { pk: "m2", name: "用户管理", parent: "m1", model: ["f1"] }
];

let state: ReturnType<typeof useRoleMenuTree>;

/** 挂载宿主组件执行 composable（onMounted 内加载数据） */
const mountHost = () => {
  const Host = defineComponent({
    name: "RoleMenuTreeHost",
    setup() {
      state = useRoleMenuTree();
      return () => h("div");
    }
  });
  mount(Host);
  return state;
};

beforeEach(() => {
  messageMock.mockReset();
  fetchAllRowsMock.mockReset();
  hasAuthMock.mockReset();
});

describe("useRoleMenuTree 菜单树回填", () => {
  it("无字段权限：菜单整树仍然回填，不再整树空白", async () => {
    hasAuthMock.mockImplementation(
      (auth: string) => auth === "list:SystemMenu"
    );
    fetchAllRowsMock.mockResolvedValue({
      code: 1000,
      data: { results: MENU_ROWS }
    });

    const state = mountHost();
    await flushPromises();

    const tree = state.menuTreeData.value as PermissionTreeNode[];
    expect(tree).toHaveLength(1); // 根节点 m1
    expect(tree[0].children).toHaveLength(1); // 子节点 m2
  });

  it("字段接口失败：菜单树不受影响（catch 静默，只损失字段节点）", async () => {
    hasAuthMock.mockReturnValue(true);
    fetchAllRowsMock.mockImplementation(async (api: unknown) => {
      if (api === menuApi.list) {
        return { code: 1000, data: { results: MENU_ROWS } };
      }
      throw new Error("field api down");
    });

    const state = mountHost();
    await flushPromises();

    const tree = state.menuTreeData.value as PermissionTreeNode[];
    expect(tree).toHaveLength(1);
    const menuLeaf = (tree[0].children as PermissionTreeNode[])[0];
    expect(menuLeaf.pk).toBe("m2");
    // 字段接口失败 → 无注入的字段分组子节点
    expect(menuLeaf.children).toBeUndefined();
  });

  it("字段接口成功：绑定模型的叶子菜单注入字段分组节点", async () => {
    hasAuthMock.mockReturnValue(true);
    const fieldRows = [
      {
        pk: "f1",
        label: "用户",
        children: [{ pk: "u1", label: "username" }]
      }
    ];
    fetchAllRowsMock.mockImplementation(async (api: unknown) => {
      if (api === menuApi.list) {
        return { code: 1000, data: { results: MENU_ROWS } };
      }
      if (api === modelLabelFieldApi.list) {
        return { code: 1000, data: { results: fieldRows } };
      }
      return { code: 1000, data: { results: [] } };
    });

    const state = mountHost();
    await flushPromises();

    const tree = state.menuTreeData.value as PermissionTreeNode[];
    const menuLeaf = (tree[0].children as PermissionTreeNode[])[0];
    const groups = menuLeaf.children as PermissionTreeNode[];
    expect(groups).toHaveLength(1);
    expect(groups[0].pk).toBe("+f1"); // 字段分组键约定
    const leaves = groups[0].children as PermissionTreeNode[];
    expect(leaves[0].pk).toBe("m2+u1"); // 字段叶子键约定
  });

  it("菜单业务失败：给出错误反馈且不再拉取字段清单", async () => {
    hasAuthMock.mockReturnValue(true);
    fetchAllRowsMock.mockResolvedValue({
      code: 1001,
      detail: "没有权限",
      data: null
    });

    mountHost();
    await flushPromises();

    expect(fetchAllRowsMock).toHaveBeenCalledTimes(1);
    expect(messageMock).toHaveBeenCalled();
  });
});
