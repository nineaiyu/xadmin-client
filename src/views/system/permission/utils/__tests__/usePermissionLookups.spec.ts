import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 数据权限页注册表数据源单测。
 *
 * 核心回归：缺 `list:SystemMenu` / `list:SystemModelLabelField` 时不再静默
 * 返回空注册表，而是标记缺失权限并阻止页面继续新增/编辑（由 hook 消费）。
 */

const { hasAuthMock, fetchAllRowsMock, choicesMock, formatFiledAppParentMock } =
  vi.hoisted(() => ({
    hasAuthMock: vi.fn(),
    fetchAllRowsMock: vi.fn(),
    choicesMock: vi.fn(),
    formatFiledAppParentMock: vi.fn()
  }));

vi.mock("@/router/utils", () => ({ hasAuth: hasAuthMock }));
vi.mock("@/utils/metaCache", () => ({
  META_KEYS: { menu: "menu" },
  fetchMetaList: (_key: string, fetcher: () => Promise<unknown>) => fetcher()
}));
vi.mock("@/api/system/menu", () => ({ menuApi: { list: Symbol("menuApi") } }));
vi.mock("@/api/system/field", () => ({
  modelLabelFieldApi: {
    list: Symbol("fieldApi"),
    choices: choicesMock
  }
}));
vi.mock("@/utils/fetchAllRows", () => ({ fetchAllRows: fetchAllRowsMock }));
vi.mock("@/plugins/i18n", () => ({ transformI18n: (value: string) => value }));
vi.mock("@/views/system/hooks", () => ({
  formatFiledAppParent: formatFiledAppParentMock
}));

import { usePermissionLookups } from "../usePermissionLookups";
import { menuApi } from "@/api/system/menu";
import { modelLabelFieldApi } from "@/api/system/field";

const MENU_ROWS = [
  { pk: "m1", parent: null, menu_type: 0, meta: { title: "系统管理" } },
  { pk: "m2", parent: "m1", menu_type: 1, meta: { title: "用户管理" } }
];

let state: ReturnType<typeof usePermissionLookups>;

const mountHost = () => {
  const Host = defineComponent({
    name: "PermissionLookupsHost",
    setup() {
      state = usePermissionLookups();
      return () => h("div");
    }
  });
  mount(Host);
  return state;
};

beforeEach(() => {
  hasAuthMock.mockReset();
  fetchAllRowsMock.mockReset();
  choicesMock.mockReset();
  formatFiledAppParentMock.mockReset();
  choicesMock.mockResolvedValue({ code: 1000, choices_dict: {} });
});

describe("usePermissionLookups 依赖权限", () => {
  it("两个 list 权限都缺失：标记缺失项、阻止保存且不请求列表", async () => {
    hasAuthMock.mockReturnValue(false);

    const state = mountHost();
    await flushPromises();

    expect(state.missingPermissions.value).toEqual([
      "list:SystemMenu",
      "list:SystemModelLabelField"
    ]);
    expect(state.lookupBlocked.value).toBe(true);
    expect(fetchAllRowsMock).not.toHaveBeenCalled();
    // choices 无 list 权限门槛，仍应请求（值控件元数据不依赖上述两个权限点）
    expect(choicesMock).toHaveBeenCalled();
  });

  it("权限齐全：菜单/字段注册表与规则类型均回填，不触发阻止态", async () => {
    hasAuthMock.mockReturnValue(true);
    fetchAllRowsMock.mockImplementation(async (api: unknown) => {
      if (api === menuApi.list) {
        return { code: 1000, data: { results: MENU_ROWS } };
      }
      if (api === modelLabelFieldApi.list) {
        return {
          code: 1000,
          data: {
            results: [{ pk: "f1", label: "用户", parent: null }]
          }
        };
      }
      return { code: 1000, data: { results: [] } };
    });
    choicesMock.mockResolvedValue({
      code: 1000,
      choices_dict: {
        choices: [{ value: "eq", label: "等于" }],
        matches: { eq: "等于" }
      }
    });

    const state = mountHost();
    await flushPromises();

    expect(state.missingPermissions.value).toEqual([]);
    expect(state.lookupBlocked.value).toBe(false);
    expect(state.menuRows.value).toHaveLength(2);
    expect(state.fieldLookupsData.value).toHaveLength(1);
    expect(state.fieldLookupsRole.value).toHaveLength(1);
    expect(state.valuesData.value).toHaveLength(1);
    expect(state.matchTexts.value.eq).toBe("等于");
  });

  it("菜单列表业务失败：标记加载失败并阻止保存", async () => {
    hasAuthMock.mockReturnValue(true);
    fetchAllRowsMock.mockResolvedValue({
      code: 1001,
      detail: "没有权限",
      data: null
    });

    const state = mountHost();
    await flushPromises();

    expect(state.lookupBlocked.value).toBe(true);
    expect(state.missingPermissions.value).toEqual([]);
  });

  it("规则类型 choices 异常：同样标记加载失败（值控件不可用）", async () => {
    hasAuthMock.mockReturnValue(true);
    fetchAllRowsMock.mockResolvedValue({
      code: 1000,
      data: { results: [] }
    });
    choicesMock.mockRejectedValue(new Error("choices down"));

    const state = mountHost();
    await flushPromises();

    expect(state.lookupBlocked.value).toBe(true);
  });
});
