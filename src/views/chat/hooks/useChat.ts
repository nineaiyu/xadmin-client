import { useChatCore } from "./useChatCore";
import { useChatActions } from "./useChatActions";
import { useChatLifecycle } from "./useChatLifecycle";

export { genClientMsgId } from "./chatIds";

/**
 * 聊天室核心状态（消息流 + WS + 历史分页 + 发送幂等）。
 *
 * - WS：自建 `ws/chat/` 连接（不与 user store 的全局通知连接争抢 onmessage）；
 * - 发送幂等：乐观上屏用 client_msg_id，服务端广播回来后按 id/client_msg_id 对齐覆盖；
 * - 未读：接收方由服务端 chat_unread 帧驱动，本地清零点在「切到该会话 / 会话内收到消息」；
 * - 历史：before_id 游标向上翻页，保留滚动位置。
 *
 * 装配拆分（对外返回面不变）：
 * - useChatCore     状态与基础域（滚动 / 消息集合 / WS / 历史）；
 * - useChatActions  动作域（发送 / AI 流式 / 附件 / 撤回与表情回应）；
 * - useChatLifecycle 会话切换与卸载清理。
 */
export function useChat() {
  const core = useChatCore();
  const actions = useChatActions(core);

  useChatLifecycle({
    activeRoomId: core.activeRoomId,
    abortStream: actions.abortStream,
    loadHistory: core.loadHistory,
    markRead: core.markRead,
    disconnect: core.disconnect,
    dispose: core.disposeMessageStore
  });

  return {
    // 状态
    roomState: core.roomState,
    rooms: core.roomState.rooms,
    contacts: core.roomState.contacts,
    activeRoom: core.roomState.activeRoom,
    activeRoomId: core.activeRoomId,
    messages: core.messages,
    messageGroups: core.messageGroups,
    hasMore: core.hasMore,
    loadingHistory: core.loadingHistory,
    loadingMore: core.loadingMore,
    streaming: core.streaming,
    connected: core.connected,
    pendingCount: core.pendingCount,
    uploading: actions.uploading,
    scroller: core.scroller,
    me: core.me,
    // 操作
    connect: core.connect,
    disconnect: core.disconnect,
    activate: core.roomState.activate,
    loadHistory: core.loadHistory,
    loadMore: core.loadMore,
    onScroll: () => core.onScroll(core.loadMore),
    scrollToBottom: core.scrollToBottom,
    send: actions.send,
    sendAttachment: actions.sendAttachment,
    sendAi: actions.sendAi,
    resend: actions.resend,
    recall: actions.recall,
    toggleReaction: actions.toggleReaction,
    markRead: core.markRead,
    isMine: core.isMine,
    upsertMessage: core.upsertMessage,
    /** 停止生成：中断进行中的 AI 流（已到达增量随 streaming 复位丢弃） */
    abortStream: actions.abortStream
  };
}

export type ChatState = ReturnType<typeof useChat>;
