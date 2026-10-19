import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useMessageScroll } from "./useMessageScroll";

/** 最小滚动容器桩：真实 div + 覆盖 jsdom 无语义布局的几何属性 */
function scrollerStub(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number
) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight, writable: true, configurable: true },
    clientHeight: { value: clientHeight, writable: true, configurable: true },
    scrollTop: { value: scrollTop, writable: true, configurable: true }
  });
  return element;
}

describe("useMessageScroll 滚动定位", () => {
  it("scrollToBottom 在 nextTick 后把 scrollTop 置到 scrollHeight", async () => {
    const scroll = useMessageScroll();
    const element = scrollerStub(800, 0, 300);
    scroll.scroller.value = element;

    scroll.scrollToBottom();
    await nextTick();

    expect(element.scrollTop).toBe(800);
  });

  it("onScroll 按离底阈值更新 atBottom，顶部 40px 内触发上翻", () => {
    const scroll = useMessageScroll();
    const element = scrollerStub(800, 500, 300);
    scroll.scroller.value = element;
    const loadMore = vi.fn();

    scroll.onScroll(loadMore);
    expect(scroll.atBottom.value).toBe(true);

    element.scrollTop = 100; // 800-100-300=400，离底
    scroll.onScroll(loadMore);
    expect(scroll.atBottom.value).toBe(false);

    element.scrollTop = 20; // 顶部 40px 内
    scroll.onScroll(loadMore);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("滚动元素未就绪时 onScroll 是空操作", () => {
    const scroll = useMessageScroll();
    const loadMore = vi.fn();

    scroll.onScroll(loadMore);

    expect(scroll.atBottom.value).toBe(true);
    expect(loadMore).not.toHaveBeenCalled();
  });
});
