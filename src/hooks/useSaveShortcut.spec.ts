import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { useSaveShortcut } from "./useSaveShortcut";

function mountShortcut(save: () => void, enabled?: () => boolean) {
  return mount(
    defineComponent({
      setup() {
        useSaveShortcut(save, enabled);
        return () => h("div");
      }
    })
  );
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    ...init
  });
  const preventDefault = vi.spyOn(event, "preventDefault");
  window.dispatchEvent(event);
  return preventDefault;
}

describe("useSaveShortcut", () => {
  it("Ctrl/S 与 Cmd/S 触发保存并阻止浏览器默认行为", () => {
    const save = vi.fn();
    const wrapper = mountShortcut(save);
    expect(press("s", { ctrlKey: true })).toHaveBeenCalled();
    expect(press("S", { metaKey: true })).toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("未按修饰键 / 其他按键不触发", () => {
    const save = vi.fn();
    const wrapper = mountShortcut(save);
    press("s");
    press("a", { ctrlKey: true });
    expect(save).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("enabled 返回 false 时不响应也不拦截", () => {
    const save = vi.fn();
    const wrapper = mountShortcut(save, () => false);
    expect(press("s", { ctrlKey: true })).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("卸载后移除监听", () => {
    const save = vi.fn();
    const wrapper = mountShortcut(save);
    wrapper.unmount();
    press("s", { ctrlKey: true });
    expect(save).not.toHaveBeenCalled();
  });
});
