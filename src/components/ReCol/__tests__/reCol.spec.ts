import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReCol from "../index";

describe("ReCol", () => {
  it("value 同时映射到五个响应式断点，并透传其余属性", () => {
    const wrapper = mount(ReCol, {
      props: { value: 12 },
      attrs: { class: "custom-col" },
      slots: { default: "<span class='slot'>内容</span>" }
    });
    const col = wrapper.find(".el-col");
    expect(col.exists()).toBe(true);
    ["xs", "sm", "md", "lg", "xl"].forEach(breakpoint => {
      expect(col.classes()).toContain(`el-col-${breakpoint}-12`);
    });
    expect(col.classes()).toContain("custom-col");
    expect(wrapper.find(".slot").text()).toBe("内容");
  });

  it("默认 24 栅格", () => {
    const wrapper = mount(ReCol);
    expect(wrapper.find(".el-col").classes()).toContain("el-col-24");
  });
});
