import { ref } from "vue";
import type { ChatMessageItem } from "@/api/chat";
import { useMessageTimeGroups } from "@/hooks/useMessageCollection";
import { useRooms } from "./useRooms";
import { createMessageStore } from "./chatMessages";
import type { ChatStreaming } from "./useChatStreaming";
import { useChatScroll } from "./useChatScroll";
import { useChatHistory } from "./useChatHistory";
import { useChatSocket } from "./useChatSocket";

/**
 * 聊天室核心状态与基础域装配（自 useChat 抽出，行数门禁）：消息流 + 滚动 +
 * 消息集合写入口径（chatMessages.ts）+ WS（useChatSocket）+ 历史分页
 * （useChatHistory）。动作域见 useChatActions，会话切换/卸载见 useChatLifecycle。
 * 状态由本 hook 持有，经返回值注入动作域。
 */
export function useChatCore() {
  const roomState = useRooms();

  const messages = ref<ChatMessageItem[]>([]);
  /** AI 流式回答（SSE）：roomId 为归属会话，content 为已到达的增量拼接 */
  const streaming = ref<ChatStreaming>(null);
  const me = ref({ pk: 0, username: "", avatar: "" });

  const activeRoomId = roomState.activeRoomId;

  /** 时间分隔：首条 / 跨天 / 间隔超过阈值时插入分组标签（口径见 utils/timeGroups） */
  const messageGroups = useMessageTimeGroups(messages);

  function isMine(item: ChatMessageItem) {
    return !!item.sender_pk && item.sender_pk === me.value.pk;
  }

  // ------------------------------------------------------------------ 滚动

  const { scroller, atBottom, pendingCount, scrollToBottom, onScroll } =
    useChatScroll();

  // ------------------------------------ 消息集合写入口径（乐观上屏 / 对齐 / 撤回）

  const store = createMessageStore(messages, () => ({
    roomId: activeRoomId.value,
    roomType: roomState.activeRoom.value?.room_type ?? "",
    sender: me.value
  }));
  const {
    upsert: upsertMessage,
    applyRecall,
    applyReactions,
    pushText,
    pushAttachment,
    dispose: disposeMessageStore
  } = store;

  // ------------------------------------------------------------------ WS

  const { connected, socket, connect, disconnect, markRead } = useChatSocket({
    activeRoomId,
    me,
    roomState,
    upsertMessage,
    applyRecall,
    applyReactions,
    isMine,
    atBottom,
    pendingCount,
    scrollToBottom
  });

  // ---------------------------------------------------------- 历史与已读

  const { hasMore, loadingHistory, loadingMore, loadHistory, loadMore } =
    useChatHistory({
      messages,
      activeRoomId,
      scroller,
      pendingCount,
      scrollToBottom
    });

  return {
    // 状态
    roomState,
    messages,
    streaming,
    me,
    activeRoomId,
    messageGroups,
    isMine,
    scroller,
    atBottom,
    pendingCount,
    scrollToBottom,
    onScroll,
    // 消息集合写入口径
    upsertMessage,
    applyRecall,
    applyReactions,
    pushText,
    pushAttachment,
    disposeMessageStore,
    // WS 与历史
    connected,
    socket,
    connect,
    disconnect,
    markRead,
    hasMore,
    loadingHistory,
    loadingMore,
    loadHistory,
    loadMore
  };
}
