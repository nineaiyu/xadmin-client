import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  roomList: vi.fn(),
  contacts: vi.fn()
}));

vi.mock("@/api/chat", () => ({
  chatApi: {
    roomList: mocks.roomList,
    contacts: mocks.contacts,
    openPrivate: vi.fn()
  }
}));

import { useRooms } from "../useRooms";

describe("useRooms 加载失败态", () => {
  beforeEach(() => {
    mocks.roomList.mockReset();
    mocks.contacts.mockReset();
  });

  it("请求失败时置 roomsError，不伪装成空列表", async () => {
    mocks.roomList.mockRejectedValue(new Error("network"));
    const state = useRooms();
    await state.loadRooms();
    expect(state.roomsError.value).toBe(true);
    expect(state.rooms.value).toEqual([]);
  });

  it("成功加载后清除失败态", async () => {
    mocks.roomList
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        code: 1000,
        data: { rooms: [], ai_enabled: false, ai_hint: "" }
      });
    const state = useRooms();
    await state.loadRooms();
    expect(state.roomsError.value).toBe(true);
    await state.loadRooms();
    expect(state.roomsError.value).toBe(false);
  });
});
