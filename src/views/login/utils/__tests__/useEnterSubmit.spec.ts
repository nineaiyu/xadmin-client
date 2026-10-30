import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEnterSubmit } from "../useEnterSubmit";

const mountHook = () => {
  const handler = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        useEnterSubmit(handler);
        return () => h("div");
      }
    })
  );
  return { handler, wrapper };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useEnterSubmit", () => {
  it("普通 Enter 触发提交", () => {
    const { handler, wrapper } = mountHook();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Enter",
        key: "Enter",
        bubbles: true
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("输入法组合态的 Enter 不提交", () => {
    const { handler, wrapper } = mountHook();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Enter",
        key: "Enter",
        isComposing: true,
        bubbles: true
      })
    );
    expect(handler).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("弹层内的 Enter 不触发表单提交", () => {
    const { handler, wrapper } = mountHook();
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    document.body.appendChild(overlay);
    overlay.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Enter",
        key: "Enter",
        bubbles: true
      })
    );
    expect(handler).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
