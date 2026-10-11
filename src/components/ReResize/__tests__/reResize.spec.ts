import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import ReResize from "../src/index.vue";

const pointer = (type: string, init: MouseEventInit = {}) =>
  new MouseEvent(type, { bubbles: true, button: 0, ...init });

const mountResize = (props: Record<string, unknown> = {}) =>
  mount(ReResize, {
    props: { x: 10, y: 10, w: 100, h: 100, ...props },
    slots: { default: "<div class='inner' />" }
  });

describe("ReResize 可拖拽缩放盒", () => {
  it("渲染 8 个手柄并应用位置 / 尺寸样式", () => {
    const wrapper = mountResize({ z: 5 });
    expect(wrapper.findAll(".re-resize__stick")).toHaveLength(8);
    const style = wrapper.find(".re-resize").attributes("style") ?? "";
    expect(style).toContain("left: 10px");
    expect(style).toContain("top: 10px");
    expect(style).toContain("width: 100px");
    expect(style).toContain("height: 100px");
    expect(wrapper.find(".inner").exists()).toBe(true);
  });

  it("sticks 可裁剪；isResizable=false 时不渲染手柄", () => {
    expect(
      mountResize({ sticks: ["br"] }).findAll(".re-resize__stick")
    ).toHaveLength(1);
    expect(
      mountResize({ isResizable: false }).findAll(".re-resize__stick")
    ).toHaveLength(0);
  });

  it("拖动：pointerdown + window pointermove 更新位置并发 dragging / dragstop", async () => {
    const wrapper = mountResize();
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    window.dispatchEvent(
      pointer("pointermove", { clientX: 30, clientY: 5, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("dragging")?.at(-1)).toEqual([40, 15]);

    window.dispatchEvent(pointer("pointerup"));
    expect(wrapper.emitted("dragstop")?.at(-1)).toEqual([40, 15]);
    expect(wrapper.emitted("activated")).toBeTruthy();
    expect(wrapper.emitted("deactivated")).toBeTruthy();
  });

  it("缩放：右下角手柄按位移改变尺寸并发 resizing / resizestop", async () => {
    const wrapper = mountResize();
    wrapper
      .find(".re-resize__stick--br")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    window.dispatchEvent(
      pointer("pointermove", { clientX: 50, clientY: 30, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("resizing")?.at(-1)).toEqual([10, 10, 150, 130]);

    window.dispatchEvent(pointer("pointerup"));
    expect(wrapper.emitted("resizestop")?.at(-1)).toEqual([10, 10, 150, 130]);
  });

  it("isDraggable=false 时拖动不生效", async () => {
    const wrapper = mountResize({ isDraggable: false });
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    expect(wrapper.emitted("activated")).toBeUndefined();
    expect(wrapper.emitted("dragging")).toBeUndefined();
  });

  it("dragHandle 未命中时不启动拖动", () => {
    const wrapper = mountResize({ dragHandle: ".handle-only" });
    wrapper
      .find(".inner")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    expect(wrapper.emitted("activated")).toBeUndefined();
  });

  it("点击内容发出 clicked", async () => {
    const wrapper = mountResize();
    await wrapper.find(".re-resize").trigger("click");
    expect(wrapper.emitted("clicked")).toBeTruthy();
  });
});
