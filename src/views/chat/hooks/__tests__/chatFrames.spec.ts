import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

import { dispatchChatFrame, type ChatFrameContext } from "../chatFrames";
import type { RoomsState } from "../useRooms";

function buildRoomState() {
  // 补全 useRooms 全量返回态（未消费成员以 vi.fn 占位），替身与源类型严格重叠
  const loadRooms = vi.fn<ChatFrameContext["roomState"]["loadRooms"]>();
  const applyUnread = vi.fn<ChatFrameContext["roomState"]["applyUnread"]>();
  const roomState: RoomsState = {
    rooms: ref([]),
    contacts: ref([]),
    aiEnabled: ref(false),
    aiHint: ref(""),
    activeRoomId: ref(0),
    activeRoom: computed(() => null),
    publicRoom: computed(() => null),
    unreadTotal: computed(() => 0),
    loadingRooms: ref(false),
    loadingContacts: ref(false),
    roomsError: ref(false),
    loadRooms,
    loadContacts: vi.fn<ChatFrameContext["roomState"]["loadContacts"]>(),
    upsertRoom: vi.fn<ChatFrameContext["roomState"]["upsertRoom"]>(),
    activate: vi.fn<ChatFrameContext["roomState"]["activate"]>(),
    openPrivate: vi.fn<ChatFrameContext["roomState"]["openPrivate"]>(),
    applyUnread,
    clearUnread: vi.fn<ChatFrameContext["roomState"]["clearUnread"]>(),
    touchRoom: vi.fn<ChatFrameContext["roomState"]["touchRoom"]>(() => true)
  };
  return { roomState, loadRooms, applyUnread };
}

function buildContext() {
  const { roomState, loadRooms, applyUnread } = buildRoomState();
  const ctx: ChatFrameContext = {
    activeRoomId: ref(1),
    me: ref({ pk: 1, username: "tester", avatar: "" }),
    roomState,
    upsertMessage: vi.fn<ChatFrameContext["upsertMessage"]>(() => true),
    applyRecall: vi.fn<ChatFrameContext["applyRecall"]>(),
    applyReactions: vi.fn<ChatFrameContext["applyReactions"]>(),
    isMine: vi.fn<ChatFrameContext["isMine"]>(() => false),
    atBottom: ref(true),
    pendingCount: ref(0),
    scrollToBottom: vi.fn<ChatFrameContext["scrollToBottom"]>(),
    markRead: vi.fn<ChatFrameContext["markRead"]>()
  };
  return { ctx, loadRooms, applyUnread };
}

describe("dispatchChatFrame 群资料变更", () => {
  it("chat_room 帧触发会话列表重拉（成员/名称同步给其他成员）", () => {
    const { ctx, loadRooms } = buildContext();

    dispatchChatFrame(
      { action: "chat_room", data: { room_id: 2, change: "members" } },
      ctx
    );

    expect(loadRooms).toHaveBeenCalledTimes(1);
  });

  it("chat_unread 帧只更新未读，不触发全量重拉", () => {
    const { ctx, loadRooms, applyUnread } = buildContext();

    dispatchChatFrame(
      { action: "chat_unread", data: { room_id: 2, unread_count: 3 } },
      ctx
    );

    expect(applyUnread).toHaveBeenCalledWith(2, 3);
    expect(loadRooms).not.toHaveBeenCalled();
  });
});
