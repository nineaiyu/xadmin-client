import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock("@/router/utils", () => ({ hasAuth: () => true }));
vi.mock("@/api/user/notifications", () => ({
  userMsgSubscriptionApi: {
    baseApi: "/api/notifications/system-msg-subscription",
    list: vi.fn()
  }
}));

// 工厂内定义替身组件（vi.mock 提升到文件顶部，不能引用顶层变量）
vi.mock("@/views/system/components/MessageNotifications.vue", async () => {
  const { defineComponent } = await import("vue");
  return {
    default: defineComponent({
      name: "MessageNotifications",
      props: ["api", "auth"],
      template: "<div class='message-notifications-stub' />"
    })
  };
});

import MessageNotifications from "@/views/system/components/MessageNotifications.vue";
import Notifications from "./Notifications.vue";

describe("通知订阅页签", () => {
  it("渲染标题与跨端提示，并挂载订阅面板", () => {
    const wrapper = mount(Notifications);

    expect(wrapper.find("h3").text()).toBe("account.notifications");
    expect(wrapper.text()).toContain("account.subCrossHint");
    expect(wrapper.find(".message-notifications-stub").exists()).toBe(true);
  });

  it("订阅面板收到通知域 API 与三项权限门", () => {
    const wrapper = mount(Notifications);
    const panel = wrapper.findComponent(MessageNotifications);

    expect((panel.props("api") as { baseApi: string }).baseApi).toBe(
      "/api/notifications/system-msg-subscription"
    );
    expect(panel.props("auth")).toEqual({
      partialUpdate: true,
      list: true,
      backends: true
    });
  });
});
