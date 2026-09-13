import { computed, ref } from "vue";
import {
  chatApi,
  type ChatMessageItem,
  type ChatPeer,
  type ChatRoomItem
} from "@/api/chat";

/** 会话在左列表的分区固定顺序：公共聊天室 → AI 助手 → 私聊 */
const PINNED_ORDER: Record<string, number> = { public: 0, ai: 1, private: 2 };

/**
 * 会话列表状态（左栏）：固定会话 + 私聊 + 未读红点 + 最近在线联系人。
 *
 * 数据源是 REST（GET /api/chat/room、/api/chat/contacts），未读与最后消息由
 * WS 帧（chat_unread / chat_message）实时增量更新，避免频繁整表刷新。
 */
export function useRooms() {
  const rooms = ref<ChatRoomItem[]>([]);
  const contacts = ref<ChatPeer[]>([]);
  const aiEnabled = ref(false);
  const aiHint = ref("");
  const activeRoomId = ref<number>(0);
  const loadingRooms = ref(false);
  const loadingContacts = ref(false);

  const activeRoom = computed(
    () => rooms.value.find(room => room.id === activeRoomId.value) ?? null
  );
  const publicRoom = computed(
    () => rooms.value.find(room => room.room_type === "public") ?? null
  );
  const unreadTotal = computed(() =>
    rooms.value.reduce((total, room) => total + (room.unread_count || 0), 0)
  );

  /** 私聊按「未读优先 + 最后消息倒序」，公共/AI 固定在前（保持加载顺序） */
  function sortRooms() {
    rooms.value.sort((a, b) => {
      const orderA = PINNED_ORDER[a.room_type] ?? 3;
      const orderB = PINNED_ORDER[b.room_type] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      if (a.room_type !== "private") return 0;
      const unreadA = a.unread_count > 0 ? 0 : 1;
      const unreadB = b.unread_count > 0 ? 0 : 1;
      if (unreadA !== unreadB) return unreadA - unreadB;
      return (b.last_message_time || "").localeCompare(
        a.last_message_time || ""
      );
    });
  }

  async function loadRooms() {
    loadingRooms.value = true;
    try {
      const { code, data } = await chatApi.roomList();
      if (code === 1000) {
        rooms.value = data?.rooms ?? [];
        aiEnabled.value = !!data?.ai_enabled;
        aiHint.value = data?.ai_hint ?? "";
        sortRooms();
        if (!activeRoomId.value && rooms.value.length) {
          activeRoomId.value = rooms.value[0].id;
        }
      }
    } finally {
      loadingRooms.value = false;
    }
  }

  async function loadContacts() {
    loadingContacts.value = true;
    try {
      const { code, data } = await chatApi.contacts();
      if (code === 1000) contacts.value = data?.results ?? [];
    } finally {
      loadingContacts.value = false;
    }
  }

  function upsertRoom(room: ChatRoomItem) {
    const index = rooms.value.findIndex(item => item.id === room.id);
    if (index >= 0) rooms.value[index] = { ...rooms.value[index], ...room };
    else rooms.value.push({ ...room, unread_count: room.unread_count ?? 0 });
    sortRooms();
  }

  function activate(roomId: number) {
    activeRoomId.value = roomId;
  }

  /** 开通（或复用）私聊并切到该会话：对端已存在会话时幂等复用 */
  async function openPrivate(peerPk: number) {
    const { code, data, detail } = await chatApi.openPrivate(peerPk);
    if (code !== 1000 || !data) return { ok: false, detail };
    upsertRoom(data);
    activate(data.id);
    return { ok: true, detail: "" };
  }

  function applyUnread(roomId: number, unreadCount: number) {
    const room = rooms.value.find(item => item.id === roomId);
    if (room) {
      room.unread_count = unreadCount;
      sortRooms();
    }
  }

  function clearUnread(roomId: number) {
    const room = rooms.value.find(item => item.id === roomId);
    if (room) room.unread_count = 0;
  }

  /**
   * 本地增量更新会话摘要（收到新消息时调用）。
   *
   * 不在列表里（如对端刚发起的私聊）时返回 false，由调用方触发一次整表刷新。
   */
  function touchRoom(message: ChatMessageItem, incrementUnread = false) {
    const room = rooms.value.find(item => item.id === message.room_id);
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
    sortRooms();
    return true;
  }

  return {
    rooms,
    contacts,
    aiEnabled,
    aiHint,
    activeRoomId,
    activeRoom,
    publicRoom,
    unreadTotal,
    loadingRooms,
    loadingContacts,
    loadRooms,
    loadContacts,
    upsertRoom,
    activate,
    openPrivate,
    applyUnread,
    clearUnread,
    touchRoom
  };
}

export type RoomsState = ReturnType<typeof useRooms>;
