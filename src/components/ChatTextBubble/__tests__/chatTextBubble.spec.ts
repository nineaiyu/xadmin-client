import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

describe("ChatTextBubble 文本气泡", () => {
  it("自己的消息取主色气泡，他人的取浅色气泡", () => {
    const mine = mount(Component, { props: { content: "好的", mine: true } });
    expect(mine.classes()).toContain("bg-(--el-color-primary)");
    expect(mine.text()).toBe("好的");

    const other = mount(Component, { props: { content: "收到" } });
    expect(other.classes()).toContain("bg-(--el-fill-color-light)");
  });

  it("撤回占位优先于正文；弱化态为斜体", () => {
    const recalled = mount(Component, {
      props: { content: "原文", recalledText: "消息已撤回" }
    });
    expect(recalled.text()).toBe("消息已撤回");
    expect(recalled.text()).not.toContain("原文");

    const muted = mount(Component, {
      props: { content: "模型只给了思考", muted: true }
    });
    expect(muted.find("span.italic").exists()).toBe(true);
  });

  it("内容走插值渲染，不把 HTML 当标记（XSS 兜底）", () => {
    const wrapper = mount(Component, {
      props: { content: "<b>x</b>" }
    });
    expect(wrapper.find("b").exists()).toBe(false);
    expect(wrapper.text()).toBe("<b>x</b>");
  });
});
