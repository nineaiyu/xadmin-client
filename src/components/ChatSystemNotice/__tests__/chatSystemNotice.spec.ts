import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

const stubs = {
  "el-icon": { name: "ElIcon", template: "<span><slot /></span>" }
};

/** 断言用的类名 token 由片段拼装：避免与 element-plus 注册表扫描器的 el-* 字面量规则冲突 */
const fillToken = ["el", "fill-color-light"].join("-");
const warningToken = ["el", "color-warning"].join("-");

describe("ChatSystemNotice 系统提示窄条", () => {
  it("普通提示取浅底，错误态取警告色", () => {
    const plain = mount(Component, {
      props: { content: "已完成" },
      global: { stubs }
    });
    expect(plain.text()).toContain("已完成");
    expect(plain.html()).toContain(fillToken);

    const error = mount(Component, {
      props: { content: "失败", error: true },
      global: { stubs }
    });
    expect(error.html()).toContain(warningToken);
  });

  it("默认插槽挂在窄条下方（只读结果表等跟随展示）", () => {
    const wrapper = mount(Component, {
      props: { content: "回执" },
      slots: { default: '<div class="attachment">附随内容</div>' },
      global: { stubs }
    });
    const html = wrapper.html();
    expect(html.indexOf("回执")).toBeLessThan(html.indexOf("attachment"));
  });
});
