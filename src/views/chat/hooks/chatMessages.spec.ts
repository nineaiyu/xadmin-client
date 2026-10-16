import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { ChatMessageItem } from "@/api/chat";
import type { ChatRoomMessage } from "@/utils/websocket/protocol";
import { RECALL_WINDOW_MS, createMessageStore } from "./chatMessages";

/** 服务端广播载荷样本（ChatRoomMessage 与 ChatMessageItem 同形状） */
const serverMessage = (overrides: Partial<ChatRoomMessage>) =>
  ({
    id: 7,
    room_id: 1,
    room_type: "public",
    sender_pk: 2,
    sender_name: "alice",
    sender_avatar: "",
    message_type: "text",
    content: "hello",
    created_time: "2026-10-02T00:00:00Z",
    client_msg_id: "",
    extra: {},
    ...overrides
  }) as ChatMessageItem;

const disposers: Array<() => void> = [];

function buildStore() {
  const messages = ref<ChatMessageItem[]>([]);
  const store = createMessageStore(messages, () => ({
    roomId: 1,
    roomType: "public",
    sender: { pk: 1, username: "bob", avatar: "" }
  }));
  // 每个用例结束都释放窗口巡检定时器，避免用例间悬挂 interval
  disposers.push(store.dispose);
  return { messages, ...store };
}

afterEach(() => {
  disposers.splice(0).forEach(dispose => dispose());
});

describe("createMessageStore 表情回应与消息写入", () => {
  it("upsert 按 client_msg_id 对齐覆盖乐观气泡（服务端载荷赢），纯新消息追加并报告新增", () => {
    const { messages, upsert, pushText } = buildStore();
    pushText("draft", "c-1");
    expect(messages.value).toHaveLength(1);

    // 广播携带同一 client_msg_id：对齐覆盖而非追加（sending/failed 随覆盖复位）
    const appended = upsert(
      serverMessage({ id: 7, content: "正式消息", client_msg_id: "c-1" })
    );
    expect(appended).toBe(false);
    expect(messages.value).toHaveLength(1);
    expect(messages.value[0]).toMatchObject({
      id: 7,
      content: "正式消息",
      sending: false,
      failed: false
    });

    // 全新消息（id 与 client_msg_id 均未命中）：追加并报告新增
    const fresh = upsert(serverMessage({ id: 8, content: "另一条" }));
    expect(fresh).toBe(true);
    expect(messages.value).toHaveLength(2);
    expect(messages.value[1].id).toBe(8);
  });

  it("applyReactions 以广播全量表整体替换，不影响消息其余字段", () => {
    const { messages, upsert, applyReactions } = buildStore();
    upsert(
      serverMessage({
        id: 7,
        message_type: "text",
        content: "可回应消息",
        extra: { reactions: { "👍": [2] } }
      })
    );

    applyReactions({ room: 1, message: 7, reactions: { "❤️": [1, 3] }, ts: 1 });
    expect(messages.value[0].extra?.reactions).toEqual({ "❤️": [1, 3] });
    expect(messages.value[0].content).toBe("可回应消息");

    applyReactions({ room: 1, message: 7, reactions: {}, ts: 2 });
    expect(messages.value[0].extra?.reactions).toEqual({});
  });

  it("applyReactions 对不存在/其他房间的消息静默忽略", () => {
    const { messages, applyReactions } = buildStore();
    applyReactions({ room: 1, message: 404, reactions: { "👍": [1] }, ts: 1 });
    expect(messages.value).toHaveLength(0);
  });

  it("applyRecall 冻结消息：内容清空、不可再回应入口（撤回即终态）", () => {
    const { messages, upsert, applyRecall } = buildStore();
    upsert(serverMessage({ id: 7, content: "待撤回", can_recall: true }));
    applyRecall({ message_id: 7, room_id: 1 });
    expect(messages.value[0]).toMatchObject({
      is_recalled: true,
      content: "",
      can_recall: false
    });
  });

  it("pushAttachment 按附件种类上屏消息类型（音视频消息同链路）", () => {
    const { messages, pushAttachment } = buildStore();
    pushAttachment(
      {
        pk: "9",
        filename: "clip.mp4",
        filesize: 10,
        mime_type: "video/mp4",
        category: "video",
        kind: "video",
        url: "/api/chat/message/1/file",
        missing: false
      },
      "c-2"
    );
    expect(messages.value[0]).toMatchObject({
      message_type: "video",
      content: "clip.mp4",
      extra: { file: { kind: "video" } }
    });
  });
});

describe("createMessageStore 本地撤回窗口", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("own 消息：乐观上屏即置位 can_recall，广播回显（载荷不带该字段）后保留", () => {
    const { messages, pushText, upsert } = buildStore();
    pushText("草稿", "c-1");
    expect(messages.value[0]).toMatchObject({
      sender_pk: 1,
      sending: true,
      can_recall: true
    });

    // 广播回来的正式载荷不带 can_recall：对齐覆盖后本地置位继续有效
    upsert(
      serverMessage({
        id: 7,
        client_msg_id: "c-1",
        sender_pk: 1,
        created_time: new Date().toISOString()
      })
    );
    expect(messages.value[0]).toMatchObject({ id: 7, can_recall: true });

    // 多端回显（无乐观前身的本人广播消息）同样本地置位
    upsert(
      serverMessage({
        id: 9,
        sender_pk: 1,
        created_time: new Date().toISOString()
      })
    );
    expect(messages.value[1].can_recall).toBe(true);
  });

  it("他人消息不置位；服务端明确下发的 can_recall 以服务端为准", () => {
    const { messages, upsert } = buildStore();
    upsert(
      serverMessage({
        id: 8,
        sender_pk: 2,
        created_time: new Date().toISOString()
      })
    );
    expect(messages.value[0].can_recall).toBeUndefined();

    // 服务端明确 false（历史口径）：不得被本地置位翻成 true
    upsert(
      serverMessage({
        id: 10,
        sender_pk: 1,
        can_recall: false,
        created_time: new Date().toISOString()
      })
    );
    expect(messages.value[1].can_recall).toBe(false);

    // 服务端明确 true：原样保留
    upsert(
      serverMessage({
        id: 11,
        sender_pk: 1,
        can_recall: true,
        created_time: new Date().toISOString()
      })
    );
    expect(messages.value[2].can_recall).toBe(true);
  });

  it("窗口过期：巡检把超窗的本人消息 can_recall 复位，他人消息不受影响", () => {
    const { messages, upsert } = buildStore();
    const fresh = new Date(Date.now() - 60_000).toISOString();
    const stale = new Date(
      Date.now() - RECALL_WINDOW_MS - 60_000
    ).toISOString();
    upsert(serverMessage({ id: 7, sender_pk: 1, created_time: fresh }));
    upsert(serverMessage({ id: 8, sender_pk: 2, created_time: fresh }));
    // 历史口径下发的 true 也可能随停留时间超窗：巡检同样复位（与服务端此刻判定一致）
    upsert(
      serverMessage({
        id: 9,
        sender_pk: 1,
        can_recall: true,
        created_time: stale
      })
    );
    expect(messages.value[0].can_recall).toBe(true);
    expect(messages.value[2].can_recall).toBe(true);

    // 推进到窗口过期后的下一个巡检点（巡检间隔内允许少量超窗残留）
    vi.advanceTimersByTime(RECALL_WINDOW_MS + 60_000);
    expect(messages.value[0].can_recall).toBe(false);
    expect(messages.value[1].can_recall).toBeUndefined();
    expect(messages.value[2].can_recall).toBe(false);
  });

  it("过期复位后不再复活：乱序重放同一条消息（广播不带 can_recall）不重新置位", () => {
    const { messages, pushText, upsert } = buildStore();
    pushText("草稿", "c-1");
    vi.advanceTimersByTime(RECALL_WINDOW_MS + 60_000);
    expect(messages.value[0].can_recall).toBe(false);

    upsert(
      serverMessage({
        id: 7,
        client_msg_id: "c-1",
        sender_pk: 1,
        created_time: new Date(
          Date.now() - RECALL_WINDOW_MS - 1000
        ).toISOString()
      })
    );
    expect(messages.value[0].can_recall).toBe(false);
  });

  it("applyRecall 撤回终态不受巡检影响（复位只针对未撤回消息）", () => {
    const { messages, upsert, applyRecall } = buildStore();
    upsert(
      serverMessage({
        id: 7,
        sender_pk: 1,
        can_recall: true,
        created_time: new Date().toISOString()
      })
    );
    applyRecall({ message_id: 7, room_id: 1 });
    vi.advanceTimersByTime(RECALL_WINDOW_MS + 60_000);
    expect(messages.value[0]).toMatchObject({
      is_recalled: true,
      content: "",
      can_recall: false
    });
  });
});
