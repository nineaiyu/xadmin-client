import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ hovers: [] as Ref<boolean>[] }));

vi.mock("@vueuse/core", async importOriginal => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  const { ref: createRef } = await import("vue");
  return {
    ...actual,
    useElementHover: () => {
      const hover = createRef(false);
      mocks.hovers.push(hover);
      return hover;
    }
  };
});

import { useHoverToggle, type HoverToggleController } from "./useHoverToggle";

type HoverDelay = Parameters<typeof useHoverToggle>[1];

function mountHost(delay?: HoverDelay) {
  const el = ref<HTMLElement | null>(null);
  let value: Ref<boolean> | undefined;
  let controller: HoverToggleController | undefined;

  const Host = defineComponent({
    setup() {
      [value, controller] = useHoverToggle(el, delay);
      return () => h("div", { ref: el });
    }
  });
  mount(Host);

  return {
    get value() {
      return value!;
    },
    get controller() {
      return controller!;
    }
  };
}

describe("useHoverToggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.hovers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("进入立即为真，离开延迟到期后为假", async () => {
    const { value } = mountHost({ enterDelay: 0, leaveDelay: 100 });
    await nextTick();
    expect(mocks.hovers.length).toBeGreaterThan(0);

    mocks.hovers[0].value = true;
    await nextTick();
    expect(value.value).toBe(true);

    mocks.hovers[0].value = false;
    await nextTick();
    expect(value.value).toBe(true);
    vi.advanceTimersByTime(100);
    expect(value.value).toBe(false);
  });

  it("进入延迟：窗口内不置真，到期置真", async () => {
    const { value } = mountHost({ enterDelay: 50, leaveDelay: 0 });
    await nextTick();

    mocks.hovers[0].value = true;
    await nextTick();
    expect(value.value).toBe(false);

    vi.advanceTimersByTime(50);
    expect(value.value).toBe(true);
  });

  it("controller.disable 暂停监听（暂停期间不置真）", async () => {
    const { value, controller } = mountHost({ enterDelay: 0, leaveDelay: 0 });
    await nextTick();

    controller.disable();
    mocks.hovers[0].value = true;
    await nextTick();
    expect(value.value).toBe(false);
  });
});
