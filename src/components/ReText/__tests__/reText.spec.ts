import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const tippyMock = vi.hoisted(() => ({
  setProps: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn()
}));

vi.mock("vue-tippy", () => ({
  useTippy: () => tippyMock
}));

import ReText from "../src/index.vue";

const ElTextStub = {
  name: "ElText",
  props: {
    truncated: { type: [Boolean, String], default: false },
    lineClamp: { type: [String, Number], default: undefined }
  },
  template:
    '<span class="stub-text" :data-truncated="String(truncated)" ' +
    ':data-clamp="lineClamp"><slot /></span>'
};

const mountText = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(ReText, {
    props,
    slots,
    global: { stubs: { "el-text": ElTextStub } }
  });

describe("ReText 省略文本", () => {
  it("渲染默认插槽内容", () => {
    const wrapper = mountText({}, { default: "一段较长的文本" });
    expect(wrapper.find(".stub-text").text()).toBe("一段较长的文本");
  });

  it("未传 lineClamp 时单行省略（truncated=true）；传 lineClamp 时按行数截断", () => {
    expect(
      mountText({}, { default: "x" })
        .find(".stub-text")
        .attributes("data-truncated")
    ).toBe("true");
    const multi = mountText({ lineClamp: 2 }, { default: "x" });
    expect(multi.find(".stub-text").attributes("data-truncated")).toBe("false");
    expect(multi.find(".stub-text").attributes("data-clamp")).toBe("2");
  });

  it("expand=true：点击切换展开态并发出 expandChange，展开后解除截断", async () => {
    const wrapper = mountText(
      { expand: true, lineClamp: 2 },
      { default: "很长很长的文本" }
    );
    const el = wrapper.find(".stub-text");
    expect(el.attributes("data-clamp")).toBe("2");

    await el.trigger("click");
    expect(wrapper.emitted("expandChange")).toEqual([[true]]);
    expect(wrapper.find(".stub-text").attributes("data-clamp")).toBe(undefined);

    await wrapper.find(".stub-text").trigger("click");
    expect(wrapper.emitted("expandChange")).toEqual([[true], [false]]);
    expect(wrapper.find(".stub-text").attributes("data-clamp")).toBe("2");
  });

  it("expand 缺省（false）时点击不切换、不发出事件", async () => {
    const wrapper = mountText({}, { default: "文本" });
    await wrapper.find(".stub-text").trigger("click");
    expect(wrapper.emitted("expandChange")).toBeUndefined();
  });

  it("tooltip=false 时悬浮不触发提示；默认开启且未截断时关闭提示", async () => {
    const off = mountText({ tooltip: false }, { default: "文本" });
    await off.find(".stub-text").trigger("mouseover");
    expect(tippyMock.enable).not.toHaveBeenCalled();
    expect(tippyMock.disable).not.toHaveBeenCalled();

    const on = mountText({}, { default: "文本" });
    await on.find(".stub-text").trigger("mouseover");
    // jsdom 下 scrollWidth/clientWidth 均为 0，判定为未截断 → 关闭提示
    expect(tippyMock.disable).toHaveBeenCalled();
    expect(tippyMock.enable).not.toHaveBeenCalled();
  });

  it("文本被截断时挂载 hover 提示", async () => {
    const wrapper = mountText({}, { default: "截断文本" });
    const el = wrapper.find(".stub-text").element as HTMLElement;
    Object.defineProperty(el, "scrollWidth", {
      value: 200,
      configurable: true
    });
    Object.defineProperty(el, "clientWidth", {
      value: 100,
      configurable: true
    });
    await wrapper.find(".stub-text").trigger("mouseover");
    expect(tippyMock.enable).toHaveBeenCalled();
  });
});
