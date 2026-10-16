import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import Component from "../index.vue";

describe("MessageTimeDivider 时间分隔行", () => {
  it("渲染调用方传入的分组标签", () => {
    const wrapper = mount(Component, { props: { label: "昨天 14:32" } });
    expect(wrapper.text()).toBe("昨天 14:32");
    expect(wrapper.find("span").exists()).toBe(true);
  });
});
