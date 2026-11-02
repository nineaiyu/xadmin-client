import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusTrap } from "@/hooks/useFocusTrap";

function mountTrap() {
  const active = ref(false);
  const onEscape = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        useFocusTrap(root, active, { initialFocus: "#b", onEscape });
        return { root };
      },
      template:
        '<div ref="root" tabindex="-1">' +
        '<button id="a">a</button><button id="b">b</button><button id="c">c</button>' +
        "</div>"
    }),
    { attachTo: document.body }
  );
  return { wrapper, active, onEscape };
}

const flushFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

describe("useFocusTrap", () => {
  beforeEach(() => {
    // jsdom 无布局：显式声明元素可见，focusables 过滤才不会把全部节点排除
    Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
      configurable: true,
      value: () => true
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("激活时聚焦 initialFocus，Tab 在末项回到首项，Esc 交回调用方", async () => {
    const { wrapper, active, onEscape } = mountTrap();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    active.value = true;
    await nextTick();
    await flushFrame();
    expect(document.activeElement?.id).toBe("b");

    document.getElementById("c")!.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
    );
    expect(document.activeElement?.id).toBe("a");

    document.getElementById("a")!.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true
      })
    );
    expect(document.activeElement?.id).toBe("c");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    expect(onEscape).toHaveBeenCalledTimes(1);

    active.value = false;
    await nextTick();
    expect(document.activeElement).toBe(outside);
    wrapper.unmount();
  });
});
