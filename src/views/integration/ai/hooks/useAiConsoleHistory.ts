import { nextTick, ref, type Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/ai/ai";

/** 历史分页每页条数（与服务端默认/上限一致：20 / 100） */
const PAGE_SIZE = 20;

/**
 * AI 控制台历史分页（自 useAiConsole 抽出）：三个入口各自独立的持久化消息流，
 * 进入/切换入口拉取最近一页，before_id 向上翻页并保持视觉位置。
 */
export function useAiConsoleHistory({
  feature,
  messages,
  scroller,
  pendingCount,
  scrollToBottom
}: {
  feature: Ref<AiConsoleFeature>;
  messages: Ref<AiConsoleMessage[]>;
  scroller: Ref<HTMLElement | null>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
}) {
  const hasMore = ref(false);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);

  async function loadHistory() {
    loadingHistory.value = true;
    messages.value = [];
    pendingCount.value = 0;
    try {
      const { code, data } = await aiAssistantApi.history({
        feature: feature.value,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = ((data?.results ?? []) as AiConsoleMessage[]) || [];
        hasMore.value = Boolean(data?.has_more);
      }
    } finally {
      loadingHistory.value = false;
    }
    await nextTick();
    scrollToBottom();
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || !messages.value.length) return;
    const firstId = messages.value[0]?.id;
    if (!firstId || firstId < 0) return;
    loadingMore.value = true;
    const container = scroller.value;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    try {
      const { code, data } = await aiAssistantApi.history({
        feature: feature.value,
        before_id: firstId,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = [
          ...(((data?.results ?? []) as AiConsoleMessage[]) || []),
          ...messages.value
        ];
        hasMore.value = Boolean(data?.has_more);
        await nextTick();
        // 保持视觉位置：新增内容的高度差补回 scrollTop（与聊天室同口径）
        if (container) {
          container.scrollTop =
            previousTop + (container.scrollHeight - previousHeight);
        }
      }
    } finally {
      loadingMore.value = false;
    }
  }

  return { hasMore, loadingHistory, loadingMore, loadHistory, loadMore };
}
