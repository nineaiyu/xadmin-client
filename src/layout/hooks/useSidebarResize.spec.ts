import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

/** 全局存储桩：useConfigureStorage 与 hook 经 useGlobal 读同一个响应式对象 */
const storage = reactive<{ configure: Record<string, unknown> }>({
  configure: { sidebarWidth: 210 }
});

vi.mock("@pureadmin/utils", async importOriginal => {
  const actual = await importOriginal<typeof import("@pureadmin/utils")>();
  return { ...actual, useGlobal: () => ({ $storage: storage }) };
});

import { useSidebarResize } from "./useSidebarResize";

function mountHost(enabled: () => boolean) {
  let api!: ReturnType<typeof useSidebarResize>;
  const Host = defineComponent({
    setup() {
      api = useSidebarResize(enabled);
      return () => h("div");
    }
  });
  mount(Host);
  return api;
}

afterEach(() => {
  storage.configure.sidebarWidth = 210;
  document.documentElement.style.removeProperty("--sidebar-width");
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

describe("useSidebarResize", () => {
  it("exposes draggable from the enabled getter", () => {
    const flag = ref(true);
    const api = mountHost(() => flag.value);
    expect(api.draggable.value).toBe(true);
    flag.value = false;
    expect(api.draggable.value).toBe(false);
  });

  it("flags out-of-range (cursor not-allowed) while dragging beyond the allowed width", () => {
    const api = mountHost(() => true);
    api.startResize(new MouseEvent("mousedown", { clientX: 210 }));

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    expect(api.resizeOutOfRange.value).toBe(true);
    expect(document.body.style.cursor).toBe("not-allowed");

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 260 }));
    expect(api.resizeOutOfRange.value).toBe(false);
    expect(document.body.style.cursor).toBe("col-resize");

    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 260 }));
    expect(api.resizing.value).toBe(false);
    expect(document.body.style.cursor).toBe("");
  });

  it("writes the CSS variable while dragging and commits the clamped width on release", () => {
    const api = mountHost(() => true);
    api.startResize(new MouseEvent("mousedown", { clientX: 210 }));

    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 260 }));
    expect(
      document.documentElement.style.getPropertyValue("--sidebar-width")
    ).toBe("260px");
    expect(storage.configure.sidebarWidth).toBe(210);

    // 越界松手：落库值被钳制到区间上限（拖拽中的视觉仍在跟手）
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 400 }));
    expect(storage.configure.sidebarWidth).toBe(320);
  });

  it("ignores a second startResize while a drag is in progress", () => {
    const api = mountHost(() => true);
    api.startResize(new MouseEvent("mousedown", { clientX: 210 }));
    api.startResize(new MouseEvent("mousedown", { clientX: 210 }));
    expect(api.resizing.value).toBe(true);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 210 }));
    expect(api.resizing.value).toBe(false);
  });
});
