import { nextTick, ref } from "vue";

/**
 * AI 控制台滚动域（自 useAiConsole 抽出）：离底检测、新消息计数与滚动定位。
 * 状态由调用方持有；顶部上翻回调经 onScroll 注入（loadMore 的守卫在历史模块内）。
 * 与聊天室（useChatScroll）同一交互口径：离底阈值 60px、顶部 40px 触发上翻。
 */
export function useAiConsoleScroll() {
  const scroller = ref<HTMLElement | null>(null);
  const atBottom = ref(true);
  /** 离底时的新消息计数（悬浮条「N 条新消息」） */
  const pendingCount = ref(0);

  function scrollToBottom() {
    pendingCount.value = 0;
    nextTick(() => {
      if (scroller.value)
        scroller.value.scrollTop = scroller.value.scrollHeight;
    });
  }

  function onScroll(onLoadMore: () => void) {
    const container = scroller.value;
    if (!container) return;
    atBottom.value =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      60;
    if (atBottom.value) pendingCount.value = 0;
    if (container.scrollTop < 40) onLoadMore();
  }

  return { scroller, atBottom, pendingCount, scrollToBottom, onScroll };
}
