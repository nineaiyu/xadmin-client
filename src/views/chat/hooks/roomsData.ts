import type { ChatMessageItem, ChatRoomItem } from "@/api/chat";

/** 会话在左列表的分区固定顺序：公共聊天室 → AI 助手 → 私聊 */
export const PINNED_ORDER: Record<string, number> = {
  public: 0,
  ai: 1,
  private: 2
};

/** 私聊按「未读优先 + 最后消息倒序」，公共/AI 固定在前（保持加载顺序） */
export function sortRooms(rooms: ChatRoomItem[]) {
  rooms.sort((a, b) => {
    const orderA = PINNED_ORDER[a.room_type] ?? 3;
    const orderB = PINNED_ORDER[b.room_type] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    if (a.room_type !== "private") return 0;
    const unreadA = a.unread_count > 0 ? 0 : 1;
    const unreadB = b.unread_count > 0 ? 0 : 1;
    if (unreadA !== unreadB) return unreadA - unreadB;
    return (b.last_message_time || "").localeCompare(a.last_message_time || "");
  });
}

/** 新增或合并会话（已存在按字段增量覆盖），随后重排 */
export function upsertRoom(rooms: ChatRoomItem[], room: ChatRoomItem) {
  const index = rooms.findIndex(item => item.id === room.id);
  if (index >= 0) rooms[index] = { ...rooms[index], ...room };
  else rooms.push({ ...room, unread_count: room.unread_count ?? 0 });
  sortRooms(rooms);
}

/** WS 未读帧落库：更新计数并按「未读优先」重排 */
export function applyUnread(
  rooms: ChatRoomItem[],
  roomId: number,
  unreadCount: number
) {
  const room = rooms.find(item => item.id === roomId);
  if (room) {
    room.unread_count = unreadCount;
    sortRooms(rooms);
  }
}

/** 本地未读清零（切到会话/会话内收到消息时先行置零） */
export function clearUnread(rooms: ChatRoomItem[], roomId: number) {
  const room = rooms.find(item => item.id === roomId);
  if (room) room.unread_count = 0;
}

/**
 * 本地增量更新会话摘要（收到新消息时调用）。不在列表里（如对端刚发起的
 * 私聊）时返回 false，由调用方触发一次整表刷新。
 */
export function touchRoom(
  rooms: ChatRoomItem[],
  message: ChatMessageItem,
  incrementUnread = false
) {
  const room = rooms.find(item => item.id === message.room_id);
  if (!room) return false;
  const summary =
    message.message_type === "system"
      ? message.content
      : `${message.sender_name || ""}: ${message.content}`;
  room.last_message = message.is_recalled ? "" : summary.slice(0, 200);
  room.last_message_time = message.created_time;
  if (incrementUnread && message.room_type !== "public") {
    room.unread_count = (room.unread_count || 0) + 1;
  }
  sortRooms(rooms);
  return true;
}
