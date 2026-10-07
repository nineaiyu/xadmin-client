import type { Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { chatApi, type ChatMessageItem } from "@/api/chat";
import { useHistoryPagination } from "@/hooks/useHistoryPagination";

/**
 * 聊天室历史分页（before_id 游标向上翻页，保留滚动位置）：分页机制收敛于
 * 共享层 useHistoryPagination（与助手页同一套守卫与滚动补偿），本文件只注入
 * 按会话拉取的端点口径；消息数组与滚动状态仍由调用方持有。
 */
export function useChatHistory({
  messages,
  activeRoomId,
  scroller,
  pendingCount,
  scrollToBottom
}: {
  messages: Ref<ChatMessageItem[]>;
  activeRoomId: Ref<number>;
  scroller: Ref<HTMLElement | null>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
}) {
  const history = useHistoryPagination<ChatMessageItem, number>({
    messages,
    scroller,
    pendingCount,
    scrollToBottom,
    // 首屏拉取用调用方传入的会话，上翻页用当前会话（切换会话后旧游标作废）
    fetchPage: async ({ beforeId, limit, initial }, room) => {
      const { code, data } = await chatApi.history(
        initial ? { room, limit } : { room, before_id: beforeId, limit }
      );
      if (code !== SUCCESS_CODE) return null;
      return { results: data?.results ?? [], hasMore: !!data?.has_more };
    },
    scopeForLoadMore: () => activeRoomId.value
  });

  return {
    ...history,
    loadHistory: (roomId: number) => history.loadHistory(roomId)
  };
}
