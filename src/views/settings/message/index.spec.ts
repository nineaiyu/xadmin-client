import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsEmailApi: {},
  settingsNotifyImApi: {},
  settingsNotifyWebhookApi: {}
}));
vi.mock("@/api/system/notifications", () => ({
  systemMsgSubscriptionApi: {}
}));
// 骨架桩：按 panes 渲染面板（与真实骨架同语义——不在 panes 里的面板不渲染），
// 面板显隐断言落在具名插槽是否被挂载上
vi.mock("@/views/settings/components/settings-shell/index.vue", () => ({
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
vi.mock("@/components/ReMessageNotifications", () => ({
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

  it("webhook 渠道页签的权限位接线正确（retrieve 缺失时由骨架过滤，不进导航）", () => {
    mocks.hasAuth.mockReturnValue(true);
    const enabled = mountPage();
    const webhookPane = (
      enabled.findComponent({ name: "Setting" }).props("panes") as Array<{
        key: string;
        item?: { auth?: { retrieve?: boolean; test?: boolean } };
      }>
    ).find(pane => pane.key === "webhook");
    // 权限齐：页签进入 panes 且读写/测试位都亮（骨架按 retrieve !== false 收进导航）
    expect(webhookPane?.item?.auth).toMatchObject({
      retrieve: true,
      partialUpdate: true,
      test: true
    });

    mocks.hasAuth.mockImplementation(
      code => !code.includes("WebhookNotifySetting")
    );
    const disabled = mountPage();
    const deniedPane = (
      disabled.findComponent({ name: "Setting" }).props("panes") as Array<{
        key: string;
        item?: { auth?: { retrieve?: boolean } };
      }>
    ).find(pane => pane.key === "webhook");
    // 权限缺：retrieve=false —— 骨架过滤规则（index.vue:50）会把它挡在导航外
    expect(deniedPane?.item?.auth?.retrieve).toBe(false);
  });
});
