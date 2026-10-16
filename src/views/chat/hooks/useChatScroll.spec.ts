import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { useChatScroll } from "./useChatScroll";

/**
 * 滚动域行为（jsdom 无布局引擎）：以可读写属性的假容器模拟 scrollTop /
 * scrollHeight / clientHeight 三个几何量，直接驱动 onScroll 的阈值判定，
 * 守护「离底 60px / 顶部 40px」两个交互常量不被合并时改动。
 */

/** 假滚动容器：仅暴露滚动域消费的几何量（scrollHeight 恒定 1000） */
function fakeContainer(geometry: {
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
}): HTMLElement {
  return {
    scrollTop: geometry.scrollTop ?? 0,
    scrollHeight: geometry.scrollHeight ?? 1000,
    clientHeight: geometry.clientHeight ?? 500
  } as HTMLElement;
}

function build(geometry: Parameters<typeof fakeContainer>[0] = {}) {
  const scroll = useChatScroll();
  const onLoadMore = vi.fn();
  scroll.scroller.value = fakeContainer(geometry);
  return { ...scroll, onLoadMore };
}

describe("useChatScroll 离底检测与滚动定位", () => {
  it("离底不足 60px 判定为贴底，并把新消息计数归零", () => {
    // 1000 - 441 - 500 = 59：阈值内视为贴底
    const scroll = build({ scrollTop: 441 });
    scroll.pendingCount.value = 3;
    scroll.onScroll(scroll.onLoadMore);
    expect(scroll.atBottom.value).toBe(true);
    expect(scroll.pendingCount.value).toBe(0);
    expect(scroll.onLoadMore).not.toHaveBeenCalled();
  });

  it("离底距离达到 60px（含边界）即视为离底，不误清新消息计数", () => {
    // 1000 - 440 - 500 = 60：不满足 <60，仍算离底
    const scroll = build({ scrollTop: 440 });
    scroll.pendingCount.value = 2;
    scroll.onScroll(scroll.onLoadMore);
    expect(scroll.atBottom.value).toBe(false);
    expect(scroll.pendingCount.value).toBe(2);
    expect(scroll.onLoadMore).not.toHaveBeenCalled();
  });

  it("滚动到顶部 40px 内触发上翻回调（边界 40px 不触发）", () => {
    const edge = build({ scrollTop: 40 });
    edge.onScroll(edge.onLoadMore);
    expect(edge.onLoadMore).not.toHaveBeenCalled();

    const top = build({ scrollTop: 39 });
    top.onScroll(top.onLoadMore);
    expect(top.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("顶部上翻与贴底判定相互独立（长列表顶端既上翻也标记离底为假）", () => {
    // 距底 1500 > 60：不在底部；scrollTop 0 < 40：仍要上翻
    const scroll = build({ scrollTop: 0, scrollHeight: 1500 });
    scroll.onScroll(scroll.onLoadMore);
    expect(scroll.atBottom.value).toBe(false);
    expect(scroll.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("滚动容器未挂载时 onScroll 静默跳过，不抛错不触发回调", () => {
    const scroll = useChatScroll();
    const onLoadMore = vi.fn();
    expect(() => scroll.onScroll(onLoadMore)).not.toThrow();
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(scroll.atBottom.value).toBe(true);
  });

  it("scrollToBottom 立即归零新消息计数，并在下一帧把 scrollTop 推到底", async () => {
    const scroll = build({ scrollTop: 100, scrollHeight: 900 });
    scroll.pendingCount.value = 5;
    scroll.scrollToBottom();
    expect(scroll.pendingCount.value).toBe(0);
    await nextTick();
    expect(scroll.scroller.value?.scrollTop).toBe(900);
  });
});
