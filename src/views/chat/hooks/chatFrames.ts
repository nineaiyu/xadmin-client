import type { Ref } from "vue";
import {
  isOutboundMessage,
  MessageAction,
  type ChatReactionUpdatePayload,
  type ChatRecallPayload,
  type ChatRoomMessage,
  type ChatUnreadPayload,
  type UserinfoPayload
} from "@/utils/websocket/protocol";
import type { ChatMessageItem } from "@/api/chat";
import type { RoomsState } from "./useRooms";

/**
 * WS 帧分派上下文：状态由 useChatSocket 持有，经 options 注入本模块；
 * 本模块只做「认帧 → 落到对应写入口径」的分派，无自身状态。
 */
export type ChatFrameContext = {
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
  markRead: (roomId: number) => void;
};

/** 收到消息帧：本会话内入集合 + 贴底/计数 + 回执已读；列表摘要同步（不在列表则整表刷新） */
function onIncomingMessage(data: ChatRoomMessage, ctx: ChatFrameContext) {
  const isActive = data.room_id === ctx.activeRoomId.value;
  if (isActive) {
    const appended = ctx.upsertMessage(data);
    if (appended) {
      if (ctx.atBottom.value) ctx.scrollToBottom();
      else ctx.pendingCount.value += 1;
    }
    // 会话内的新消息视为已读（通知服务端清零未读游标）
    if (!ctx.isMine(data) && data.message_type !== "system")
      ctx.markRead(data.room_id);
  }
  if (!ctx.roomState.touchRoom(data, !isActive)) {
    // 会话不在本地列表（对端刚发起的私聊）：拉一次会话列表补上
    ctx.roomState.loadRooms();
  }
}

/** 帧分派：userinfo / 消息 / 撤回 / 表情回应 / 未读（非本室事件一律不上屏） */
export function dispatchChatFrame(raw: unknown, ctx: ChatFrameContext) {
  if (isOutboundMessage<UserinfoPayload>(raw, MessageAction.USERINFO)) {
    const data = raw.data ?? {};
    ctx.me.value = {
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
    onIncomingMessage(raw.data, ctx);
    return;
  }
  if (isOutboundMessage<ChatRecallPayload>(raw, MessageAction.CHAT_RECALL)) {
    if (raw.data?.room_id === ctx.activeRoomId.value) ctx.applyRecall(raw.data);
    return;
  }
  if (
    isOutboundMessage<ChatReactionUpdatePayload>(
      raw,
      MessageAction.CHAT_REACTION
    ) &&
    raw.data
  ) {
    if (raw.data.room === ctx.activeRoomId.value) ctx.applyReactions(raw.data);
    return;
  }
  if (
    isOutboundMessage<ChatUnreadPayload>(raw, MessageAction.CHAT_UNREAD) &&
    raw.data
  ) {
    ctx.roomState.applyUnread(raw.data.room_id, raw.data.unread_count);
  }
}
