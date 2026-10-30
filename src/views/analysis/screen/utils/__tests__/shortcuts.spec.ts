import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useScreenShortcuts } from "../shortcuts";

function mountShortcuts() {
  const undo = vi.fn();
  const redo = vi.fn();
  const Comp = defineComponent({
    setup() {
      useScreenShortcuts({
        locked: ref(false),
        save: vi.fn(),
        undo,
        redo,
        duplicateSelected: vi.fn(),
        removeSelected: vi.fn(),
        clearSelection: vi.fn(),
        selected: computed(() => undefined),
        nudge: () => true
      });
      return () => h("input", { class: "pane-input" });
    }
  });
  const wrapper = mount(Comp, { attachTo: document.body });
  return { wrapper, undo, redo };
}

const press = (target: EventTarget, init: KeyboardEventInit) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  );

describe("useScreenShortcuts 输入控件守卫", () => {
  let wrapper: ReturnType<typeof mountShortcuts>["wrapper"] | undefined;

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("输入框聚焦时 Cmd+Z / Cmd+Y 不触发画布撤销重做", () => {
    const mounted = mountShortcuts();
    wrapper = mounted.wrapper;
    const input = wrapper.find("input").element;

    const undoEvent = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: true,
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(undoEvent);
    press(input, { key: "y", metaKey: true });

    expect(mounted.undo).not.toHaveBeenCalled();
    expect(mounted.redo).not.toHaveBeenCalled();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("非输入控件聚焦时撤销仍生效", () => {
    const mounted = mountShortcuts();
    wrapper = mounted.wrapper;

    press(document.body, { key: "z", metaKey: true });

    expect(mounted.undo).toHaveBeenCalledTimes(1);
  });
});
