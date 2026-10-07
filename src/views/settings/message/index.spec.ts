import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsEmailApi: {},
  settingsNotifyImApi: {}
}));
vi.mock("@/api/system/notifications", () => ({
  systemMsgSubscriptionApi: {}
}));
vi.mock("@/views/settings/components/settings/index.vue", () => ({
  default: { name: "Setting", template: "<div><slot /></div>" }
}));
vi.mock("@/views/system/components/MessageNotifications.vue", () => ({
  default: {
    name: "MessageNotifications",
    template: "<div data-testid='subscription-panel' />"
  }
}));
vi.mock("./components/MessageTemplatePanel.vue", () => ({
  default: {
    name: "MessageTemplatePanel",
    template: "<div data-testid='template-panel' />"
  }
}));

import index from "./index.vue";

const mountPage = () =>
  mount(index, {
    global: {
      // el-tab-pane 桩：始终渲染插槽，页签显隐断言落在面板是否存在上
      stubs: {
        "el-tab-pane": { template: "<div><slot /></div>" }
      }
    }
  });

describe("SettingMessage 页签权限位", () => {
  it("有订阅与模板权限时两个页签都渲染", () => {
    mocks.hasAuth.mockReturnValue(true);
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="subscription-panel"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="template-panel"]').exists()).toBe(true);
  });

  it("缺模板注册表权限（list:SettingMessage）时模板页签隐藏，订阅页签不受影响", () => {
    mocks.hasAuth.mockImplementation(code => code !== "list:SettingMessage");
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="subscription-panel"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="template-panel"]').exists()).toBe(false);
  });
});
