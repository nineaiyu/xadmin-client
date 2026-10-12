import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/dom", async importOriginal => {
  const actual = await importOriginal<typeof import("@/utils/dom")>();
  return { ...actual, getScrollbarWidth: () => 15 };
});

import { SCROLL_FIXED_CLASS, useScrollLock } from "./useScrollLock";

function setSize(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: scrollHeight
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: clientHeight
  });
}

function buildLayoutTarget() {
  document.body.innerHTML =
    '<div class="app-main"><div class="el-scrollbar__wrap"></div></div>';
  const target = document.querySelector<HTMLElement>(
    ".app-main .el-scrollbar__wrap"
  )!;
  target.style.overflowY = "auto";
  setSize(target, 200, 100);
  return target;
}

function mountLock(immediate = true) {
  let locked: ReturnType<typeof useScrollLock> | undefined;
  const Host = defineComponent({
    setup() {
      locked = useScrollLock({ immediate });
      return () => h("div");
    }
  });
  mount(Host);
  return {
    get locked() {
      return locked!;
    }
  };
}

describe("useScrollLock", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.style.paddingRight = "";
    Reflect.deleteProperty(document.body, "scrollHeight");
    Reflect.deleteProperty(document.body, "clientHeight");
    Reflect.deleteProperty(document.documentElement, "scrollHeight");
  });

  it("非 body 目标：锁定写 scrollbar-gutter，解锁还原", async () => {
    const target = buildLayoutTarget();
    const { locked } = mountLock();
    await nextTick();
    await nextTick();

    expect(locked.value).toBe(true);
    expect(target.style.getPropertyValue("scrollbar-gutter")).toBe("stable");

    locked.value = false;
    expect(target.style.getPropertyValue("scrollbar-gutter")).toBe("");
  });

  it("body 目标：按滚动条宽度补偿 padding-right 并同步固定节点", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 100000
    });
    setSize(document.body, 100000, 768);
    const fixed = document.createElement("div");
    fixed.className = SCROLL_FIXED_CLASS;
    document.body.append(fixed);

    const { locked } = mountLock();
    await nextTick();
    await nextTick();

    expect(locked.value).toBe(true);
    expect(document.body.style.paddingRight).toBe("15px");
    expect(fixed.style.paddingRight).toBe("15px");

    locked.value = false;
    expect(document.body.style.paddingRight).toBe("");
    expect(fixed.style.paddingRight).toBe("");
  });

  it("immediate=false 时挂载不锁定，可手动开合", async () => {
    const target = buildLayoutTarget();
    const { locked } = mountLock(false);
    await nextTick();
    await nextTick();
    expect(locked.value).toBe(false);
    expect(target.style.getPropertyValue("scrollbar-gutter")).toBe("");

    locked.value = true;
    expect(target.style.getPropertyValue("scrollbar-gutter")).toBe("stable");
  });
});
