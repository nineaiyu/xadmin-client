import { describe, expect, it } from "vitest";
import { ref } from "vue";

import type { ChatMessageItem } from "@/api/chat";
import type { ChatRoomMessage } from "@/utils/websocket/protocol";
import { createMessageStore } from "./chatMessages";

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

function buildStore() {
  const messages = ref<ChatMessageItem[]>([]);
  const store = createMessageStore(messages, () => ({
    roomId: 1,
    roomType: "public",
    sender: { pk: 1, username: "bob", avatar: "" }
  }));
  return { messages, ...store };
}

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
