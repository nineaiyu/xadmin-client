import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock("@/api/user/token", () => ({
  personalAccessTokenApi: {
    baseApi: "/api/identity/personal-access-tokens",
    list: vi.fn()
  },
  loadPatScopeCatalog: vi.fn(() =>
    Promise.resolve({ code: 1000, data: { groups: [] } })
  )
}));

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/clipboard", () => ({ copyText: vi.fn() }));
vi.mock("@/hooks/useConfirm", () => ({
  useConfirm: () => vi.fn(() => Promise.resolve(true))
}));

vi.mock("./AccessTokenCreateForm.vue", () => ({
  default: defineComponent({
    name: "AccessTokenCreateForm",
    template: "<div class='token-create-form-stub' />"
  })
}));
vi.mock("./PatCallLogs.vue", () => ({
  default: defineComponent({
    name: "PatCallLogs",
    template: "<div class='pat-call-logs-stub' />"
  })
}));

import AccessToken from "./AccessToken.vue";

const RePlusPageStub = defineComponent({
  name: "RePlusPage",
  props: [
    "api",
    "auth",
    "selection",
    "title",
    "localeName",
    "listColumnsFormat",
    "operationButtonsProps",
    "tableBarButtonsProps"
  ],
  template: "<div class='re-plus-page-stub' />"
});

const mountPanel = async () => {
  const wrapper = mount(AccessToken, {
    global: {
      stubs: {
        RePlusPage: RePlusPageStub,
        ElAlert: true,
        ElButton: true,
        ElTag: true,
        ElTooltip: true,
        IconifyIconOffline: true
      }
    }
  });
  await flushPromises();
  return wrapper;
};

describe("访问令牌页签", () => {
  it("列表使用 /api/identity/personal-access-tokens 前缀", async () => {
    const props = (await mountPanel()).findComponent(RePlusPageStub).props();

    expect((props.api as { baseApi: string }).baseApi).toBe(
      "/api/identity/personal-access-tokens"
    );
  });

  it("只读口径：列表可见 + 内置新增/编辑/导入导出全部隐藏（创建走专用弹层）", async () => {
    const props = (await mountPanel()).findComponent(RePlusPageStub).props();

    expect(props.auth).toEqual({
      list: true,
      create: false,
      update: false,
      partialUpdate: false,
      destroy: false,
      retrieve: false,
      exportData: false,
      importData: false
    });
  });

  it("页面标题与列文案命名空间使用 accessToken 词条", async () => {
    const wrapper = await mountPanel();
    const props = wrapper.findComponent(RePlusPageStub).props();

    // 页面标题改由面板骨架渲染（列表工具栏不再重复渲染一次标题）
    expect(props.title).toBe("");
    expect(props.localeName).toBe("accessToken");
    expect(wrapper.find("h3").text()).toBe("accessToken.title");
  });
});
