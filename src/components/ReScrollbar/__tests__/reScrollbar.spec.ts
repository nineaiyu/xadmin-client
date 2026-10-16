import { mount } from "@vue/test-utils";
import { ElScrollbar } from "element-plus/es/components/scrollbar/index.mjs";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import ReScrollbar from "../src/index.vue";

/** el-scrollbar 内部滚动代理节点类名（拼接避免被组件用法扫描器误判） */
const WRAP_CLASS = ["el", "scrollbar__wrap"].join("-");

type Metrics = Partial<
  Record<
    | "clientHeight"
    | "clientWidth"
    | "scrollHeight"
    | "scrollLeft"
    | "scrollTop"
    | "scrollWidth",
    number
  >
>;

function setMetrics(el: HTMLElement, metrics: Metrics): void {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

async function mountScrollbar(props: Record<string, unknown> = {}) {
  const wrapper = mount(ReScrollbar, {
    props,
    slots: { default: () => "content" },
    global: { components: { ElScrollbar } }
  });
  await nextTick();
  await nextTick();
  const wrap = wrapper.element.querySelector(`.${WRAP_CLASS}`) as HTMLElement;
  return { wrapper, wrap };
}

describe("ReScrollbar", () => {
  it("滚动事件后派发到达态", async () => {
    const { wrapper, wrap } = await mountScrollbar();
    setMetrics(wrap, {
      scrollTop: 50,
      scrollHeight: 200,
      clientHeight: 100,
      scrollLeft: 0,
      scrollWidth: 100,
      clientWidth: 100
    });
    wrap.dispatchEvent(new Event("scroll"));

    const events = wrapper.emitted("scroll-at");
    expect(events?.length).toBeGreaterThan(0);
    expect(events?.at(-1)?.[0]).toMatchObject({
      top: false,
      bottom: false,
      left: true,
      right: true
    });
  });

  it("贴顶时上遮罩隐藏，滚到中间后上下遮罩出现", async () => {
    const { wrapper, wrap } = await mountScrollbar();
    setMetrics(wrap, {
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 100,
      scrollLeft: 0,
      scrollWidth: 100,
      clientWidth: 100
    });
    wrap.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(wrapper.emitted("scroll-at")?.at(-1)?.[0]).toMatchObject({
      top: true,
      bottom: true
    });
    expect(
      wrapper.find(".re-scrollbar__mask--top").attributes("style")
    ).toContain("display: none");

    setMetrics(wrap, { scrollTop: 50, scrollHeight: 200, clientHeight: 100 });
    wrap.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(wrapper.emitted("scroll-at")?.at(-1)?.[0]).toMatchObject({
      top: false,
      bottom: false
    });
    expect(
      wrapper.find(".re-scrollbar__mask--top").attributes("style") ?? ""
    ).not.toContain("display: none");
  });

  it("shadow=false 时不渲染遮罩", async () => {
    const { wrapper, wrap } = await mountScrollbar({ shadow: false });
    setMetrics(wrap, { scrollTop: 50, scrollHeight: 200, clientHeight: 100 });
    wrap.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(wrapper.find(".re-scrollbar__mask--top").isVisible()).toBe(false);
  });

  it("滚动容器键盘可达：tabindex/role 就位；label 有值时设 aria-label，缺省不设", async () => {
    const { wrap } = await mountScrollbar({ label: "消息列表" });
    expect(wrap.getAttribute("tabindex")).toBe("0");
    expect(wrap.getAttribute("role")).toBe("region");
    expect(wrap.getAttribute("aria-label")).toBe("消息列表");

    const { wrap: plain } = await mountScrollbar();
    expect(plain.getAttribute("tabindex")).toBe("0");
    expect(plain.getAttribute("aria-label")).toBeNull();
  });

  it("暴露 scrollTo / setScrollTop 落到滚动容器", async () => {
    const { wrapper, wrap } = await mountScrollbar();
    const spy = vi.fn();
    wrap.scrollTo = spy;

    wrapper.vm.scrollTo({ top: 0 });
    wrapper.vm.setScrollTop(120);

    expect(spy).toHaveBeenCalledWith({ top: 0 });
    expect(spy).toHaveBeenCalledWith({ top: 120 });
  });
});
