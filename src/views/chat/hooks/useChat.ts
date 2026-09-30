import { SUCCESS_CODE } from "@/api/types";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { ChatWebSocket, type WS } from "@/utils/websocket";
import {
  MessageAction,
  isOutboundMessage,
  type ChatRecallPayload,
  type ChatRoomMessage,
  type ChatUnreadPayload,
  type UserinfoPayload
} from "@/utils/websocket/protocol";
import { chatApi, type ChatMessageItem } from "@/api/chat";
import { useRooms } from "./useRooms";
import { createMessageStore } from "./chatMessages";
import { useChatAttachments } from "./useChatAttachments";
import { useChatStreaming, type ChatStreaming } from "./useChatStreaming";

/** 历史分页每页条数（与服务端默认/上限一致：20 / 50） */
const PAGE_SIZE = 20;
/** 气泡时间分组阈值：超过该间隔另起一个时间分隔 */
const TIME_GROUP_GAP = 5 * 60 * 1000;

export function genClientMsgId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return raw.replace(/-/g, "").slice(0, 32);
}

export type TimeDivider = { id: number; label: string; time: number };

/**
 * 聊天室核心状态（消息流 + WS + 历史分页 + 发送幂等）。
 *
 * - WS：自建 `ws/chat/` 连接（不与 user store 的全局通知连接争抢 onmessage）；
 * - 发送幂等：乐观上屏用 client_msg_id，服务端广播回来后按 id/client_msg_id 对齐覆盖；
 * - 未读：接收方由服务端 chat_unread 帧驱动，本地清零点在「切到该会话 / 会话内收到消息」；
 * - 历史：before_id 游标向上翻页，保留滚动位置。
 */
export function useChat() {
  const { t } = useI18n();
  const roomState = useRooms();

  const messages = ref<ChatMessageItem[]>([]);
  const hasMore = ref(false);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);
  /** AI 流式回答（SSE）：roomId 为归属会话，content 为已到达的增量拼接 */
  const streaming = ref<ChatStreaming>(null);
  const connected = ref(false);
  const socket = ref<WS>();
  const me = ref({ pk: 0, username: "", avatar: "" });
  /** 离底时的新消息计数（悬浮条「N 条新消息」） */
  const pendingCount = ref(0);

  const activeRoomId = roomState.activeRoomId;

  /** 时间分隔：首条 / 跨天 / 间隔超过阈值时插入分组标签 */
  const messageGroups = computed(() => {
    const rows: Array<
      | { type: "divider"; key: string; label: string }
      | { type: "message"; key: string; item: ChatMessageItem }
    > = [];
    let lastTime = 0;
    for (const item of messages.value) {
      const time = new Date(item.created_time).getTime();
      if (!lastTime || time - lastTime > TIME_GROUP_GAP) {
        rows.push({
          type: "divider",
          key: `d-${item.id}`,
          label: formatDivider(time)
        });
      }
      rows.push({ type: "message", key: `m-${item.id}`, item });
      lastTime = time;
    }
    return rows;
  });

  function formatDivider(time: number) {
    if (!time) return "";
    const date = new Date(time);
    const now = new Date();
    const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return hm;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (date.toDateString() === yesterday.toDateString())
      return `${t("chat.yesterday")} ${hm}`;
    return `${date.getMonth() + 1}-${date.getDate()} ${hm}`;
  }

  function isMine(item: ChatMessageItem) {
    return !!item.sender_pk && item.sender_pk === me.value.pk;
  }

  /** 消息集合写入口径（乐观上屏 / 服务端对齐 / 撤回，实现见 chatMessages.ts） */
  const store = createMessageStore(messages, () => ({
    roomId: activeRoomId.value,
    roomType: roomState.activeRoom.value?.room_type ?? "",
    sender: me.value
  }));
  const { upsert: upsertMessage, applyRecall, pushText } = store;

  // ------------------------------------------------------------------ WS

  function onFrame(raw: unknown) {
    if (isOutboundMessage<UserinfoPayload>(raw, MessageAction.USERINFO)) {
      const data = raw.data ?? {};
      me.value = {
        pk: Number(data.pk ?? 0),
        username: String(data.userinfo?.username ?? ""),
        avatar: String((data.userinfo as { avatar?: string })?.avatar ?? "")
      };
      return;
    }
    if (
      isOutboundMessage<ChatRoomMessage>(raw, MessageAction.CHAT_MESSAGE) &&
      raw.data
    ) {
      onIncomingMessage(raw.data);
      return;
    }
    if (isOutboundMessage<ChatRecallPayload>(raw, MessageAction.CHAT_RECALL)) {
      if (raw.data?.room_id === activeRoomId.value) applyRecall(raw.data);
      return;
    }
    if (
      isOutboundMessage<ChatUnreadPayload>(raw, MessageAction.CHAT_UNREAD) &&
      raw.data
    ) {
      roomState.applyUnread(raw.data.room_id, raw.data.unread_count);
    }
  }

  function onIncomingMessage(data: ChatRoomMessage) {
    const isActive = data.room_id === activeRoomId.value;
    if (isActive) {
      const appended = upsertMessage(data);
      if (appended) {
        if (atBottom.value) scrollToBottom();
        else pendingCount.value += 1;
      }
      // 会话内的新消息视为已读（通知服务端清零未读游标）
      if (!isMine(data) && data.message_type !== "system")
        markRead(data.room_id);
    }
    if (!roomState.touchRoom(data, !isActive)) {
      // 会话不在本地列表（对端刚发起的私聊）：拉一次会话列表补上
      roomState.loadRooms();
    }
  }

  function connect() {
    socket.value?.close();
    const instance = new ChatWebSocket({
      openCallback: () => {
        connected.value = true;
        instance.onMessage(onFrame);
        // 取当前登录用户主键（气泡左右对齐）；连接恢复后需重新拉取
        instance.send(JSON.stringify({ action: MessageAction.USERINFO }));
      },
      closeCallback: () => {
        connected.value = false;
      },
      errorCallback: () => {
        connected.value = false;
      }
    });
    socket.value = instance;
  }

  function disconnect() {
    socket.value?.close();
    socket.value = undefined;
    connected.value = false;
  }

  // ------------------------------------------------------------------ 历史与已读

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

  function markRead(roomId: number) {
    roomState.clearUnread(roomId);
    socket.value?.send(
      JSON.stringify({
        action: MessageAction.CHAT_READ,
        data: { room_id: roomId }
      })
    );
  }

  // ------------------------------------------------------------------ 滚动

  const scroller = ref<HTMLElement | null>(null);
  const atBottom = ref(true);

  function scrollToBottom() {
    pendingCount.value = 0;
    nextTick(() => {
      if (scroller.value)
        scroller.value.scrollTop = scroller.value.scrollHeight;
    });
  }

  function onScroll() {
    const container = scroller.value;
    if (!container) return;
    atBottom.value =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      60;
    if (atBottom.value) pendingCount.value = 0;
    if (container.scrollTop < 40) loadMore();
  }

  // ------------------------------------------------------------------ 发送

  function send(content: string) {
    const text = content.trim();
    if (!text || !activeRoomId.value) return;
    const clientMsgId = genClientMsgId();
    pushText(text, clientMsgId);
    scrollToBottom();
    if (!socket.value) {
      markFailed(clientMsgId);
      message(t("chat.disconnected"), { type: "warning" });
      return;
    }
    socket.value.send(
      JSON.stringify({
        action: MessageAction.CHAT_MESSAGE,
        data: {
          room_id: activeRoomId.value,
          content: text,
          client_msg_id: clientMsgId
        }
      })
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
    markFailed
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
    socket.value?.send(
      JSON.stringify({ action: MessageAction.CHAT_MESSAGE, data: payload })
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
    onScroll,
    scrollToBottom,
    send,
    sendAttachment,
    sendAi,
    resend,
    recall,
    markRead,
    isMine,
    upsertMessage,
    /** 停止生成：中断进行中的 AI 流（已到达增量随 streaming 复位丢弃） */
    abortStream
  };
}

export type ChatState = ReturnType<typeof useChat>;
