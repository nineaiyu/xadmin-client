import { ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { MessageAction } from "@/utils/websocket/protocol";
import { chatApi, type ChatMessageItem } from "@/api/chat";
import { useMessageTimeGroups } from "@/hooks/useMessageCollection";
import { useRooms } from "./useRooms";
import { createMessageStore } from "./chatMessages";
import { useChatAttachments } from "./useChatAttachments";
import { useChatStreaming, type ChatStreaming } from "./useChatStreaming";
import { useChatScroll } from "./useChatScroll";
import { useChatHistory } from "./useChatHistory";
import { useChatSocket } from "./useChatSocket";

export function genClientMsgId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return raw.replace(/-/g, "").slice(0, 32);
}

/**
 * 聊天室核心状态（消息流 + WS + 历史分页 + 发送幂等）。
 *
 * - WS：自建 `ws/chat/` 连接（不与 user store 的全局通知连接争抢 onmessage）；
 * - 发送幂等：乐观上屏用 client_msg_id，服务端广播回来后按 id/client_msg_id 对齐覆盖；
 * - 未读：接收方由服务端 chat_unread 帧驱动，本地清零点在「切到该会话 / 会话内收到消息」；
 * - 历史：before_id 游标向上翻页，保留滚动位置。
 *
 * 职责拆分（状态由本 hook 持有，子模块经 options 注入）：
 * - useChatScroll     离底检测 / 新消息计数 / 滚动定位；
 * - useChatHistory    历史分页（before_id 游标、滚动位置保持）；
 * - useChatSocket     WS 连接 / 帧分派 / 已读上报；
 * - chatMessages      消息集合写入口径（乐观上屏 / 服务端对齐 / 撤回）；
 * - useChatStreaming  AI 流式（SSE）发送与中断；
 * - useChatAttachments 附件发送（上传 + 乐观上屏 + WS 上行）。
 */
export function useChat() {
  const { t } = useI18n();
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

  // -------------------------------------------------- 消息集合写入口径（乐观上屏 / 服务端对齐 / 撤回）

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

  // ------------------------------------------------------------------ 历史与已读

  const { hasMore, loadingHistory, loadingMore, loadHistory, loadMore } =
    useChatHistory({
      messages,
      activeRoomId,
      scroller,
      pendingCount,
      scrollToBottom
    });

  // ------------------------------------------------------------------ 发送

  /**
   * WS 上行（失败收口）：仅判 socket 存在不够——连接未就绪/重连竞态下
   * send 可能抛错或报文无声丢失。断连或异常时把乐观行标记失败并复用
   * 断连提示，交给用户手动重发（resend 沿用原 client_msg_id 幂等）。
   */
  function sendChatFrame(
    payload: Record<string, unknown>,
    clientMsgId?: string
  ): boolean {
    if (!socket.value || !connected.value) {
      if (clientMsgId) markFailed(clientMsgId);
      message(t("chat.disconnected"), { type: "warning" });
      return false;
    }
    try {
      socket.value.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      if (clientMsgId) markFailed(clientMsgId);
      message(t("chat.disconnected"), { type: "warning" });
      console.warn("[chat] ws send failed:", error);
      return false;
    }
  }

  function send(content: string) {
    const text = content.trim();
    if (!text || !activeRoomId.value) return;
    const clientMsgId = genClientMsgId();
    pushText(text, clientMsgId);
    scrollToBottom();
    sendChatFrame(
      {
        action: MessageAction.CHAT_MESSAGE,
        data: {
          room_id: activeRoomId.value,
          content: text,
          client_msg_id: clientMsgId
        }
      },
      clientMsgId
    );
  }

  /** AI 流式（SSE）发送与中断（实现见 useChatStreaming.ts） */
  const { sendAi, abortStream } = useChatStreaming({
    activeRoomId,
    streaming,
    genClientMsgId,
    pushText,
    upsertMessage,
    scrollToBottom,
    atBottom,
    markFailed
  });

  /** 附件发送（上传 + 乐观上屏 + WS 上行，实现见 useChatAttachments.ts） */
  const { uploading, sendAttachment } = useChatAttachments({
    activeRoomId,
    socket,
    genClientMsgId,
    pushAttachment: store.pushAttachment,
    scrollToBottom,
    markFailed,
    sendFrame: sendChatFrame
  });

  function markFailed(clientMsgId: string, detail?: string) {
    const target = messages.value.find(
      item => item.client_msg_id === clientMsgId
    );
    if (target) {
      target.sending = false;
      target.failed = true;
    }
    if (detail) message(detail, { type: "warning" });
  }

  /** 重发失败消息（沿用原 client_msg_id：服务端幂等，不会重复落库） */
  function resend(item: ChatMessageItem) {
    if (!item.client_msg_id) return;
    item.failed = false;
    item.sending = true;
    if (item.message_type === "ai" || item.room_type === "ai") {
      item.sending = false;
      sendAi(item.content);
      return;
    }
    const payload: Record<string, unknown> = {
      room_id: activeRoomId.value,
      content: item.content,
      client_msg_id: item.client_msg_id
    };
    if (item.message_type === "image" || item.message_type === "file") {
      // 附件消息重发：沿用已上传的附件引用（服务端幂等，不会重复落库）
      const filePk = item.extra?.file?.pk;
      if (!filePk) {
        item.sending = false;
        item.failed = true;
        return;
      }
      payload.message_type = item.message_type;
      payload.file_pk = filePk;
    }
    // 上行失败由 sendChatFrame 收口：行重新标记 failed，保留重发入口
    sendChatFrame(
      { action: MessageAction.CHAT_MESSAGE, data: payload },
      item.client_msg_id
    );
  }

  async function recall(item: ChatMessageItem) {
    const { code, detail } = await chatApi.recall(item.id);
    if (code === SUCCESS_CODE) {
      applyRecall({ message_id: item.id, room_id: item.room_id });
    } else {
      message(detail, { type: "warning" });
    }
  }

  /** 表情回应（chat_reaction 上行）：本地已在回应中则移除，否则添加；
   * 全量回应表由广播帧整体替换（限流与发送共用 5 条/秒）；
   * 上行经 sendChatFrame 收口（断连判定 + 异常吞掉提示，此前裸 send 在重连竞态下
   * 可能抛错或无声丢失） */
  function toggleReaction(item: ChatMessageItem, emoji: string) {
    const op = item.extra?.reactions?.[emoji]?.includes(me.value.pk)
      ? "remove"
      : "add";
    sendChatFrame({
      action: MessageAction.CHAT_REACTION,
      data: { message: item.id, emoji, op }
    });
  }

  // 切换会话：中断流 + 拉历史 + 清未读（本地红点 + 服务端游标）
  watch(
    activeRoomId,
    async roomId => {
      abortStream();
      if (!roomId) return;
      await loadHistory(roomId);
      markRead(roomId);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    abortStream();
    disconnect();
    // 停掉消息集合的撤回窗口巡检定时器
    disposeMessageStore();
  });

  return {
    // 状态
    roomState,
    rooms: roomState.rooms,
    contacts: roomState.contacts,
    activeRoom: roomState.activeRoom,
    activeRoomId,
    messages,
    messageGroups,
    hasMore,
    loadingHistory,
    loadingMore,
    streaming,
    connected,
    pendingCount,
    uploading,
    scroller,
    me,
    // 操作
    connect,
    disconnect,
    activate: roomState.activate,
    loadHistory,
    loadMore,
    onScroll: () => onScroll(loadMore),
    scrollToBottom,
    send,
    sendAttachment,
    sendAi,
    resend,
    recall,
    toggleReaction,
    markRead,
    isMine,
    upsertMessage,
    /** 停止生成：中断进行中的 AI 流（已到达增量随 streaming 复位丢弃） */
    abortStream
  };
}

export type ChatState = ReturnType<typeof useChat>;
