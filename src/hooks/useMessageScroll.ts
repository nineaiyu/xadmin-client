import { nextTick, ref } from "vue";

/**
 * 消息流滚动域（聊天室 / AI 控制台共用）：离底检测、新消息计数与滚动定位。
 * 状态由调用方持有（与流式 / 附件等子域同口径），顶部上翻回调经 onScroll 注入
 * （loadMore 的守卫在历史分页模块内）。交互常量两线同口径：离底阈值 60px、
 * 顶部 40px 内触发上翻。
 */
export function useMessageScroll() {
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

export type MessageScrollState = ReturnType<typeof useMessageScroll>;
