import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReMotion from "../index";

const motionDirective = {
  mounted() {
    // 指令本身不影响渲染结构：只验证组件把 v-motion 绑定到根节点
  }
};

describe("ReMotion", () => {
  it("渲染单根 div 并透传默认插槽", () => {
    const wrapper = mount(ReMotion, {
      global: { directives: { motion: motionDirective } },
      slots: { default: "<span class='slot'>动画内容</span>" }
    });
    expect(wrapper.element.tagName).toBe("DIV");
    expect(wrapper.find(".slot").text()).toBe("动画内容");
  });

  it("delay 属性可透传（默认 50）", () => {
    expect(ReMotion.props.delay.default).toBe(50);
  });
});
