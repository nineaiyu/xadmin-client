import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import { useAiConsoleScroll } from "./useAiConsoleScroll";

/**
 * AI 控制台滚动域行为（jsdom 无布局引擎）：以可读写属性的假容器模拟滚动
 * 几何量，直接驱动 onScroll 的阈值判定。交互口径与聊天室 useChatScroll
 * 保持同一常量（离底 60px / 顶部 40px），合并两条滚动域时以此对账。
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
  const scroll = useAiConsoleScroll();
  const onLoadMore = vi.fn();
  scroll.scroller.value = fakeContainer(geometry);
  return { ...scroll, onLoadMore };
}

describe("useAiConsoleScroll 离底检测与滚动定位", () => {
  it("离底不足 60px 判定为贴底，并把新消息计数归零", () => {
    const scroll = build({ scrollTop: 441 });
    scroll.pendingCount.value = 4;
    scroll.onScroll(scroll.onLoadMore);
    expect(scroll.atBottom.value).toBe(true);
    expect(scroll.pendingCount.value).toBe(0);
    expect(scroll.onLoadMore).not.toHaveBeenCalled();
  });

  it("离底 60px 及以上视为离底，计数保留（悬浮条继续累计）", () => {
    const scroll = build({ scrollTop: 440 });
    scroll.pendingCount.value = 2;
    scroll.onScroll(scroll.onLoadMore);
    expect(scroll.atBottom.value).toBe(false);
    expect(scroll.pendingCount.value).toBe(2);
  });

  it("顶部 40px 内触发上翻回调，边界 40px 不触发", () => {
    const edge = build({ scrollTop: 40 });
    edge.onScroll(edge.onLoadMore);
    expect(edge.onLoadMore).not.toHaveBeenCalled();

    const top = build({ scrollTop: 39 });
    top.onScroll(top.onLoadMore);
    expect(top.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("滚动容器未挂载时静默跳过；scrollToBottom 归零计数并推底", async () => {
    const detached = useAiConsoleScroll();
    const onLoadMore = vi.fn();
    expect(() => detached.onScroll(onLoadMore)).not.toThrow();
    expect(onLoadMore).not.toHaveBeenCalled();

    const scroll = build({ scrollTop: 80, scrollHeight: 1200 });
    scroll.pendingCount.value = 6;
    scroll.scrollToBottom();
    expect(scroll.pendingCount.value).toBe(0);
    await nextTick();
    expect(scroll.scroller.value?.scrollTop).toBe(1200);
  });
});
