import type { Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/ai/ai";
import { useHistoryPagination } from "@/hooks/useHistoryPagination";

/**
 * AI 控制台历史分页（before_id 游标向上翻页，保留滚动位置）：分页机制收敛于
 * 共享层 useHistoryPagination（与聊天室同一套守卫与滚动补偿），本文件只注入
 * 按入口拉取的端点口径；三个入口各自独立的持久化消息流，进入/切换入口拉取
 * 最近一页。
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
  const history = useHistoryPagination<AiConsoleMessage, AiConsoleFeature>({
    messages,
    scroller,
    pendingCount,
    scrollToBottom,
    // 两个入口方向都以调用时刻的当前入口为准
    fetchPage: async ({ beforeId, limit, initial }, current) => {
      const { code, data } = await aiAssistantApi.history(
        initial
          ? { feature: current, limit }
          : { feature: current, before_id: beforeId, limit }
      );
      if (code !== SUCCESS_CODE) return null;
      return {
        results: ((data?.results ?? []) as AiConsoleMessage[]) || [],
        hasMore: Boolean(data?.has_more)
      };
    },
    scopeForLoadMore: () => feature.value
  });

  return { ...history, loadHistory: () => history.loadHistory(feature.value) };
}
