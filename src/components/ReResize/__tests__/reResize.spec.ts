import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import ReResize from "../src/index.vue";
import type { Box } from "../src/geometry";

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

describe("ReResize props 同步与吸附钩子", () => {
  it("外部 props 变更回写内部盒模型（属性面板改数值 / 撤销回放）", async () => {
    const wrapper = mountResize();
    await wrapper.setProps({ x: 50, y: 20, w: 200, h: 150 });
    const style = wrapper.find(".re-resize").attributes("style") ?? "";
    expect(style).toContain("left: 50px");
    expect(style).toContain("top: 20px");
    expect(style).toContain("width: 200px");
    expect(style).toContain("height: 150px");
  });

  it("手势进行中忽略同值回显：写回不打断手势，后续位移仍按起手盒模型推进", async () => {
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

    // 父组件把刚拖出的值回写成 props（同值回显）：手势继续，位移从起手盒模型算起
    await wrapper.setProps({ x: 40, y: 15 });
    window.dispatchEvent(
      pointer("pointermove", { clientX: 50, clientY: 5, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("dragging")?.at(-1)).toEqual([60, 15]);

    window.dispatchEvent(pointer("pointerup"));
    expect(wrapper.emitted("dragstop")?.at(-1)).toEqual([60, 15]);
  });

  it("snap 钩子：拖动时吸附结果作为新盒模型，命中信息经 snapping 透传", async () => {
    const snap = vi.fn((box: Box) => ({
      box: { ...box, x: 100 },
      guides: [{ axis: "x", position: 100 }]
    }));
    const wrapper = mountResize({ snap });
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    window.dispatchEvent(
      pointer("pointermove", { clientX: 30, clientY: 5, buttons: 1 })
    );
    await nextTick();
    // 传入的是未吸附的候选盒模型与空方向（拖动）
    expect(snap).toHaveBeenCalledWith({ x: 40, y: 15, w: 100, h: 100 }, "");
    expect(wrapper.emitted("dragging")?.at(-1)).toEqual([100, 15]);
    expect(wrapper.emitted("snapping")?.at(-1)).toEqual([
      [{ axis: "x", position: 100 }]
    ]);
    window.dispatchEvent(pointer("pointerup"));
    expect(wrapper.emitted("dragstop")?.at(-1)).toEqual([100, 15]);
  });

  it("snap 钩子：缩放时把方位交给业务侧（按边吸附）", async () => {
    const snap = vi.fn((box: Box) => ({ box, guides: [] }));
    const wrapper = mountResize({ snap });
    wrapper
      .find(".re-resize__stick--br")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    window.dispatchEvent(
      pointer("pointermove", { clientX: 50, clientY: 30, buttons: 1 })
    );
    await nextTick();
    expect(snap).toHaveBeenCalledWith({ x: 10, y: 10, w: 150, h: 130 }, "br");
    expect(wrapper.emitted("snapping")?.at(-1)).toEqual([[]]);
    window.dispatchEvent(pointer("pointerup"));
  });

  it("父组件的 @pointerdown 与组件自身手势并存（属性透传合并，不互相顶掉）", async () => {
    const onDown = vi.fn();
    const wrapper = mountResize({ onPointerdown: onDown });
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 5, clientY: 5 })
      );
    // 父监听收到事件（画布据此「按下即选中」），组件自身手势同时生效
    expect(onDown).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      pointer("pointermove", { clientX: 25, clientY: 5, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("dragging")?.at(-1)).toEqual([30, 10]);
    window.dispatchEvent(pointer("pointerup"));
  });

  it("scale：宿主被 CSS 缩放时指针增量按 scale 换算回本地 px", async () => {
    const wrapper = mountResize({ scale: 0.5 });
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    // 屏幕位移 30px 在 0.5 缩放画布上等于本地 60px（起手 x=10 → 70）
    window.dispatchEvent(
      pointer("pointermove", { clientX: 30, clientY: 10, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("dragging")?.at(-1)).toEqual([70, 30]);
    window.dispatchEvent(pointer("pointerup"));
  });

  it("未提供 snap 钩子时不发 snapping 事件", async () => {
    const wrapper = mountResize();
    wrapper
      .find(".re-resize")
      .element.dispatchEvent(
        pointer("pointerdown", { clientX: 0, clientY: 0 })
      );
    window.dispatchEvent(
      pointer("pointermove", { clientX: 10, clientY: 10, buttons: 1 })
    );
    await nextTick();
    expect(wrapper.emitted("snapping")).toBeUndefined();
    window.dispatchEvent(pointer("pointerup"));
  });
});
