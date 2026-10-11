import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      chat: {
        newMessages: "有 {count} 条新消息"
      }
    }
  }
});

describe("NewMessagesBadge 离底新消息悬浮条", () => {
  it("计数为 0 时不渲染", () => {
    const wrapper = mount(Component, {
      props: { count: 0 },
      global: { plugins: [i18n] }
    });
    expect(wrapper.find("div").exists()).toBe(false);
  });

  it("计数大于 0 时按词条渲染并透传计数", () => {
    const wrapper = mount(Component, {
      props: { count: 3 },
      global: { plugins: [i18n] }
    });
    expect(wrapper.text()).toContain("有 3 条新消息");
  });

  it("点击悬浮条发出 jump 事件（回到底部）", async () => {
    const wrapper = mount(Component, {
      props: { count: 1 },
      global: { plugins: [i18n] }
    });
    await wrapper.find("div").trigger("click");
    expect(wrapper.emitted("jump")).toHaveLength(1);
  });
});
