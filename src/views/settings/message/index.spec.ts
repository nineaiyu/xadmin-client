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
// 骨架桩：按 panes 渲染面板（与真实骨架同语义——不在 panes 里的面板不渲染），
// 面板显隐断言落在具名插槽是否被挂载上
vi.mock("@/views/settings/components/settings/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["panes"],
    template: `<div>
      <template v-for="pane in panes" :key="pane.key">
        <slot :name="pane.key" />
      </template>
    </div>`
  }
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

const mountPage = () => mount(index, { global: {} });

describe("SettingMessage 面板权限位", () => {
  it("有订阅与模板权限时两个面板都渲染", () => {
    mocks.hasAuth.mockReturnValue(true);
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="subscription-panel"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="template-panel"]').exists()).toBe(true);
  });

  it("缺模板注册表权限（list:SettingMessage）时模板面板隐藏，订阅面板不受影响", () => {
    mocks.hasAuth.mockImplementation(code => code !== "list:SettingMessage");
    const wrapper = mountPage();

    expect(wrapper.find('[data-testid="subscription-panel"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="template-panel"]').exists()).toBe(false);
  });
});
