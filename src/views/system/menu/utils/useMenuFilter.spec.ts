import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { MenuChoices } from "@/views/system/constants";
import { buildMenuTree, normalizeMenuRow } from "./normalize";
import { useMenuFilter } from "./useMenuFilter";
import type { MenuRow } from "./types";

// useMenuFilter 仅用于判断是否启用拼音匹配：单测固定中文环境
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ locale: { value: "zh" } })
}));

// 标题翻译在单测中等价透传（真实实现依赖 i18n 实例，测试环境不构建实例）
vi.mock("@/plugins/i18n", () => ({
  transformI18n: (value: string) => value
}));

const RAW_ROWS = [
  {
    pk: 1,
    name: "system",
    path: "/system",
    menu_type: MenuChoices.DIRECTORY,
    parent: null,
    is_active: true,
    rank: 1,
    meta: { title: "系统管理" }
  },
  {
    pk: 2,
    name: "SystemUser",
    path: "/system/user/index",
    component: "system/user/index",
    menu_type: MenuChoices.MENU,
    parent: 1,
    is_active: true,
    rank: 2,
    meta: { title: "用户管理" }
  },
  {
    pk: 3,
    name: "list:SystemUser",
    path: "api/system/user$",
    method: "GET",
    menu_type: MenuChoices.PERMISSION,
    parent: 2,
    is_active: true,
    rank: 3,
    meta: { title: "用户列表" }
  },
  {
    pk: 4,
    name: "SystemRole",
    path: "/system/role/index",
    menu_type: MenuChoices.MENU,
    parent: 1,
    is_active: false,
    rank: 4,
    meta: { title: "角色管理" }
  }
];

const tree = ref<MenuRow[]>(
  buildMenuTree(
    RAW_ROWS.map(row =>
      normalizeMenuRow(row as unknown as Record<string, unknown>)
    )
  )
);

const setup = () => useMenuFilter(tree);

describe("useMenuFilter", () => {
  it("无筛选时返回原始树", () => {
    const { visibleTree, filterActive, matchPks } = setup();
    expect(filterActive.value).toBe(false);
    expect(visibleTree.value).toBe(tree.value);
    expect(matchPks.value.size).toBe(4);
  });

  it("关键字命中标题时保留祖先链路，仅命中项计入 matchPks", () => {
    const { filter, visibleTree, matchPks } = setup();
    filter.keyword = "用户管理";
    const titles = visibleTree.value.map(row => row.meta.title);
    expect(titles).toEqual(["系统管理"]);
    expect(visibleTree.value[0].children.map(row => row.meta.title)).toEqual([
      "用户管理"
    ]);
    expect([...matchPks.value]).toEqual(["2"]);
  });

  it("关键字可命中路由与组件路径（不限于标题）", () => {
    const { filter, matchPks } = setup();
    filter.keyword = "api/system/user$";
    expect([...matchPks.value]).toEqual(["3"]);
    filter.keyword = "system/role/index";
    expect([...matchPks.value]).toEqual(["4"]);
  });

  it("中文标题支持拼音命中", () => {
    const { filter, matchPks } = setup();
    filter.keyword = "yonghu";
    expect(matchPks.value.has("2")).toBe(true);
    expect(matchPks.value.has("3")).toBe(true);
  });

  it("类型筛选只保留该类型（祖先作上下文）", () => {
    const { filter, visibleTree, matchPks } = setup();
    filter.menuType = MenuChoices.PERMISSION;
    expect([...matchPks.value]).toEqual(["3"]);
    const leafTitles: string[] = [];
    const walk = (rows: MenuRow[]) =>
      rows.forEach(row => {
        if (!row.children.length) leafTitles.push(row.meta.title);
        walk(row.children);
      });
    walk(visibleTree.value);
    expect(leafTitles).toEqual(["用户列表"]);
  });

  it("状态筛选命中停用节点", () => {
    const { filter, matchPks } = setup();
    filter.status = "inactive";
    expect([...matchPks.value]).toEqual(["4"]);
  });

  it("筛选态下展开全部命中路径，未筛选时按展开层级", () => {
    const { filter, expandPks } = setup();
    filter.expandLevel = 2;
    expect([...expandPks.value]).toEqual(["1"]);
    filter.keyword = "用户";
    expect(expandPks.value.has("1")).toBe(true);
    expect(expandPks.value.has("2")).toBe(true);
  });

  it("firstMatchPk 取前序首个命中（用于筛选后滚动定位）", () => {
    const { filter, firstMatchPk } = setup();
    filter.keyword = "管理";
    expect(firstMatchPk.value).toBe("1");
    filter.keyword = "用户列表";
    expect(firstMatchPk.value).toBe("3");
  });

  it("reset 清空关键字/类型/状态但保留展开层级", () => {
    const { filter, reset, filterActive } = setup();
    filter.keyword = "用户";
    filter.menuType = MenuChoices.MENU;
    filter.status = "active";
    filter.expandLevel = 3;
    reset();
    expect(filterActive.value).toBe(false);
    expect(filter.expandLevel).toBe(3);
  });

  it("筛选结果与计算属性联动（响应式）", () => {
    const { filter, matchPks } = setup();
    const count = computed(() => matchPks.value.size);
    filter.keyword = "角色";
    expect(count.value).toBe(1);
  });
});
