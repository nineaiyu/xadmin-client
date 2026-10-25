import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true),
  usePageAuth: vi.fn(() => ({
    list: true,
    create: false,
    partialUpdate: false,
    destroy: false,
    retrieve: false,
    update: false,
    upload: false,
    exportData: false,
    importData: false,
    batchDestroy: false,
    recycleList: false
  }))
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({
  hasAuth: mocks.hasAuth,
  usePageAuth: mocks.usePageAuth
}));
// 设置壳桩：按 panes 渲染槽位（与真实骨架同语义）
vi.mock("@/views/settings/components/settings-shell/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["panes"],
    template: `<div>
      <template v-for="pane in panes" :key="pane.key">
        <slot :name="pane.key" />
      </slot>
    </div>`
  }
}));
vi.mock("./components/AiGlobalSettingsCard.vue", () => ({
  default: {
    name: "AiGlobalSettingsCard",
    template: "<div data-testid='switch-card' />"
  }
}));
vi.mock("./components/AiActiveProfilesBar.vue", () => ({
  default: {
    name: "AiActiveProfilesBar",
    template: "<div data-testid='profiles-bar' />"
  }
}));
vi.mock("./components/AiObservabilityPanel.vue", () => ({
  default: {
    name: "AiObservabilityPanel",
    template: "<div data-testid='observability-panel' />"
  }
}));
vi.mock("./utils/useAiProfiles", () => ({
  useAiProfiles: () => ({
    api: {},
    auth: {},
    listColumnsFormat: () => [],
    operationButtonsProps: {},
    tableBarButtonsProps: {}
  })
}));

import config from "./config.vue";

const paneKeys = (wrapper: ReturnType<typeof mount>) =>
  (
    wrapper.findAllComponents({ name: "Setting" })[0]!.props("panes") as Array<{
      key: string;
    }>
  ).map(pane => pane.key);

const mountPage = () => mount(config, { global: {} });

describe("AiAssistantConfig 面板权限过滤", () => {
  beforeEach(() => {
    mocks.hasAuth.mockReset();
    mocks.usePageAuth.mockReset();
    mocks.usePageAuth.mockReturnValue({
      list: true,
      create: false,
      partialUpdate: false,
      destroy: false,
      retrieve: false,
      update: false,
      upload: false,
      exportData: false,
      importData: false,
      batchDestroy: false,
      recycleList: false
    });
    // 默认全量：档案（list:AiProfile）、全局配置、观测三权限均在
    mocks.hasAuth.mockImplementation((code: string) =>
      [
        "list:AiAssistantConfig",
        "status:AiAssistant",
        "list:AiProfile",
        "create:AiProfile",
        "partialUpdate:AiProfile",
        "destroy:AiProfile",
        "retrieve:AiProfile",
        "activate:AiProfile",
        "deactivate:AiProfile",
        "test:AiProfile",
        "probe:AiProfile"
      ].includes(code)
    );
  });

  it("全量权限下按 档案 / 开关 / 观测 顺序装配三个面板", () => {
    const wrapper = mountPage();
    expect(paneKeys(wrapper)).toEqual(["profiles", "switch", "observability"]);
  });

  it("只授权用量观测时仅渲染观测面板（正交授权互相隔离）", () => {
    mocks.hasAuth.mockImplementation(
      (code: string) => code === "status:AiAssistant"
    );
    // useAiProfiles 内部 usePageAuth("AiProfile") 全 false：档案面板不出现
    mocks.usePageAuth.mockReturnValue({
      list: false,
      create: false,
      partialUpdate: false,
      destroy: false,
      retrieve: false,
      update: false,
      upload: false,
      exportData: false,
      importData: false,
      batchDestroy: false,
      recycleList: false
    });
    const wrapper = mountPage();
    expect(paneKeys(wrapper)).toEqual(["observability"]);
    expect(wrapper.find("[data-testid='observability-panel']").exists()).toBe(
      true
    );
    expect(wrapper.find("[data-testid='switch-card']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='profiles-bar']").exists()).toBe(false);
  });

  it("三个维度皆无权限时不渲染设置壳，显式空态兜底", () => {
    mocks.hasAuth.mockImplementation(() => false);
    mocks.usePageAuth.mockReturnValue({
      list: false,
      create: false,
      partialUpdate: false,
      destroy: false,
      retrieve: false,
      update: false,
      upload: false,
      exportData: false,
      importData: false,
      batchDestroy: false,
      recycleList: false
    });
    const wrapper = mountPage();
    expect(wrapper.findAllComponents({ name: "Setting" })).toHaveLength(0);
    expect(wrapper.findComponent({ name: "ReResult" }).exists()).toBe(true);
  });

  it("档案仅剩自定义动作权限（无 CRUD 位）时档案面板仍在", () => {
    mocks.hasAuth.mockImplementation((code: string) =>
      ["test:AiProfile", "probe:AiProfile"].includes(code)
    );
    mocks.usePageAuth.mockReturnValue({
      list: false,
      create: false,
      partialUpdate: false,
      destroy: false,
      retrieve: false,
      update: false,
      upload: false,
      exportData: false,
      importData: false,
      batchDestroy: false,
      recycleList: false
    });
    const wrapper = mountPage();
    expect(paneKeys(wrapper)).toEqual(["profiles"]);
  });
});
