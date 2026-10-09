import { SUCCESS_CODE } from "@/api/types";
import { computed, ref } from "vue";
import {
  chatApi,
  type ChatMessageItem,
  type ChatPeer,
  type ChatRoomItem
} from "@/api/chat";
import {
  applyUnread,
  clearUnread,
  sortRooms,
  touchRoom,
  upsertRoom
} from "./roomsData";

/**
 * 会话列表状态（左栏）：固定会话 + 私聊 + 未读红点 + 最近在线联系人。
 *
 * 数据源是 REST（GET /api/chat/room、/api/chat/contacts），未读与最后消息由
 * WS 帧（chat_unread / chat_message）实时增量更新，避免频繁整表刷新；列表内
 * 排序与增量更新口径见 roomsData.ts（纯函数，便于单测）。
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

  async function loadRooms() {
    loadingRooms.value = true;
    try {
      const { code, data } = await chatApi.roomList();
      if (code === SUCCESS_CODE) {
        rooms.value = data?.rooms ?? [];
        aiEnabled.value = !!data?.ai_enabled;
        aiHint.value = data?.ai_hint ?? "";
        sortRooms(rooms.value);
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
      if (code === SUCCESS_CODE) contacts.value = data?.results ?? [];
    } finally {
      loadingContacts.value = false;
    }
  }

  function activate(roomId: number) {
    activeRoomId.value = roomId;
  }

  /** 开通（或复用）私聊并切到该会话：对端已存在会话时幂等复用 */
  async function openPrivate(peerPk: number) {
    const { code, data, detail } = await chatApi.openPrivate(peerPk);
    if (code !== SUCCESS_CODE || !data) return { ok: false, detail };
    upsertRoom(rooms.value, data);
    activate(data.id);
    return { ok: true, detail: "" };
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
    upsertRoom: (room: ChatRoomItem) => upsertRoom(rooms.value, room),
    activate,
    openPrivate,
    applyUnread: (roomId: number, unreadCount: number) =>
      applyUnread(rooms.value, roomId, unreadCount),
    clearUnread: (roomId: number) => clearUnread(rooms.value, roomId),
    touchRoom: (message: ChatMessageItem, incrementUnread = false) =>
      touchRoom(rooms.value, message, incrementUnread)
  };
}

export type RoomsState = ReturnType<typeof useRooms>;
