import { nextTick, ref, type Ref } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { chatApi, type ChatMessageItem } from "@/api/chat";

/** 历史分页每页条数（与服务端默认/上限一致：20 / 50） */
const PAGE_SIZE = 20;

/**
 * 聊天室历史分页（自 useChat 抽出）：before_id 游标向上翻页，保留滚动位置。
 * 消息数组与滚动状态由调用方持有，本模块只负责拉取与拼接。
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
  const hasMore = ref(false);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);

  async function loadHistory(roomId: number) {
    loadingHistory.value = true;
    messages.value = [];
    pendingCount.value = 0;
    try {
      const { code, data } = await chatApi.history({
        room: roomId,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = data?.results ?? [];
        hasMore.value = !!data?.has_more;
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
      const { code, data } = await chatApi.history({
        room: activeRoomId.value,
        before_id: firstId,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = [...(data?.results ?? []), ...messages.value];
        hasMore.value = !!data?.has_more;
        await nextTick();
        // 保持视觉位置：新增内容的高度差补回 scrollTop
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
