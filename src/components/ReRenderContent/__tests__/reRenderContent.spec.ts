import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";

import ReRenderContent from "../src/index.tsx";

describe("ReRenderContent", () => {
  it("字符串按文本渲染", () => {
    const wrapper = mount(ReRenderContent, { props: { content: "hello" } });
    expect(wrapper.text()).toBe("hello");
  });

  it("数字按文本渲染", () => {
    const wrapper = mount(ReRenderContent, { props: { content: 42 } });
    expect(wrapper.text()).toBe("42");
  });

  it("renderBr 开启时按换行拆成多个段落", () => {
    const wrapper = mount(ReRenderContent, {
      props: { content: "第一行\n第二行", renderBr: true }
    });
    expect(wrapper.findAll("p")).toHaveLength(2);
  });

  it("组件按 h() 渲染", () => {
    const Inner = defineComponent({
      name: "StubInner",
      render: () => h("span", "inner")
    });
    const wrapper = mount(ReRenderContent, { props: { content: Inner } });
    expect(wrapper.text()).toBe("inner");
  });

  it("VNode 原样渲染", () => {
    const wrapper = mount(ReRenderContent, {
      props: { content: h("em", "vnode") }
    });
    expect(wrapper.find("em").text()).toBe("vnode");
  });

  it("空内容渲染为空", () => {
    const wrapper = mount(ReRenderContent, { props: { content: null } });
    expect(wrapper.html()).toBe("");
  });
});
