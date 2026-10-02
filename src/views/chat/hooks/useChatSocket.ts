import { ref } from "vue";
import type { Ref } from "vue";
import { ChatWebSocket, type WS } from "@/utils/websocket";
import {
  MessageAction,
  isOutboundMessage,
  type ChatReactionUpdatePayload,
  type ChatRecallPayload,
  type ChatRoomMessage,
  type ChatUnreadPayload,
  type UserinfoPayload
} from "@/utils/websocket/protocol";
import type { ChatMessageItem } from "@/api/chat";
import type { useRooms } from "./useRooms";

type RoomsState = ReturnType<typeof useRooms>;

/**
 * 聊天室 WS 连接域（自 useChat 抽出）：自建 `ws/chat/` 连接（不与 user store 的
 * 全局通知连接争抢 onmessage）、帧分派（userinfo/消息/撤回/表情回应/未读）与已读上报。
 * 消息集合与滚动状态由调用方持有，经 options 注入。
 */
export function useChatSocket({
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
}: {
  activeRoomId: Ref<number>;
  /** 当前登录用户（USERINFO 帧回写，气泡左右对齐依据） */
  me: Ref<{ pk: number; username: string; avatar: string }>;
  roomState: RoomsState;
  upsertMessage: (item: ChatRoomMessage) => boolean;
  applyRecall: (payload: ChatRecallPayload) => void;
  applyReactions: (payload: ChatReactionUpdatePayload) => void;
  isMine: (item: ChatMessageItem) => boolean;
  atBottom: Ref<boolean>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
}) {
  const connected = ref(false);
  const socket = ref<WS>();

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
      isOutboundMessage<ChatReactionUpdatePayload>(
        raw,
        MessageAction.CHAT_REACTION
      ) &&
      raw.data
    ) {
      if (raw.data.room === activeRoomId.value) applyReactions(raw.data);
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

  function markRead(roomId: number) {
    roomState.clearUnread(roomId);
    socket.value?.send(
      JSON.stringify({
        action: MessageAction.CHAT_READ,
        data: { room_id: roomId }
      })
    );
  }

  return { connected, socket, connect, disconnect, markRead };
}
