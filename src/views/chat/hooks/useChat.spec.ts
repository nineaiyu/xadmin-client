import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

import type { ChatMessageItem, ChatRoomItem } from "@/api/chat";
import { MessageAction } from "@/utils/websocket/protocol";

/**
 * 聊天室编排 hook 的协同冒烟：会话列表与四个子域（WS / AI 流式 / 历史分页 /
 * 附件）以替身注入，只验证 useChat 自身的装配与调度接线。说明：
 * 发送分流的「AI 房间走流式」分支位于视图层 submit（chat/index.vue），hook
 * 内等价分支由 resend 的 AI 消息路径覆盖；消息集合写入口径（chatMessages）
 * 与滚动域为真实实现，顺带覆盖乐观上屏与失败标记的联动。
 */

const hooks = vi.hoisted(() => ({
  socketSend: vi.fn(),
  /** 替身 WS 实例（undefined 模拟未连接），由各用例在挂载前设置 */
  socketInstance: undefined as { send: (frame: string) => void } | undefined,
  /** 替身连接态：发送门控按 connected 收口（各用例可翻转） */
  connectedValue: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  markRead: vi.fn(),
  sendAi: vi.fn(),
  abortStream: vi.fn(),
  loadHistory: vi.fn(),
  loadMore: vi.fn(),
  sendAttachment: vi.fn(),
  recallApi: vi.fn(),
  message: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: hooks.message }));
vi.mock("@/api/chat", () => ({ chatApi: { recall: hooks.recallApi } }));

vi.mock("./useChatSocket", () => ({
  useChatSocket: () => ({
    connected: {
      get value() {
        return hooks.connectedValue;
      }
    },
    socket: { value: hooks.socketInstance },
    connect: hooks.connect,
    disconnect: hooks.disconnect,
    markRead: hooks.markRead
  })
}));

vi.mock("./useChatStreaming", () => ({
  useChatStreaming: () => ({
    sendAi: hooks.sendAi,
    abortStream: hooks.abortStream
  })
}));

vi.mock("./useChatHistory", () => ({
  useChatHistory: () => ({
    hasMore: { value: false },
    loadingHistory: { value: false },
    loadingMore: { value: false },
    loadHistory: hooks.loadHistory,
    loadMore: hooks.loadMore
  })
}));

vi.mock("./useChatAttachments", () => ({
  useChatAttachments: () => ({
    uploading: { value: 0 },
    sendAttachment: hooks.sendAttachment
  })
}));

// 会话列表替身：状态按 hook 调用独立创建，activate 与真实实现同口径地推进 activeRoomId
vi.mock("./useRooms", async () => {
  const { computed, ref } = await import("vue");
  return {
    useRooms: () => {
      const rooms = ref<ChatRoomItem[]>([]);
      const contacts = ref([]);
      const activeRoomId = ref(0);
      return {
        rooms,
        contacts,
        aiEnabled: ref(false),
        aiHint: ref(""),
        activeRoomId,
        activeRoom: computed(
          () => rooms.value.find(room => room.id === activeRoomId.value) ?? null
        ),
        publicRoom: computed(() => null),
        unreadTotal: computed(() => 0),
        loadingRooms: ref(false),
        loadingContacts: ref(false),
        loadRooms: vi.fn(),
        loadContacts: vi.fn(),
        upsertRoom: vi.fn(),
        activate: (roomId: number) => {
          activeRoomId.value = roomId;
        },
        openPrivate: vi.fn(),
        applyUnread: vi.fn(),
        clearUnread: vi.fn(),
        touchRoom: vi.fn(() => true)
      };
    }
  };
});

import { genClientMsgId, useChat, type ChatState } from "./useChat";

const room = (overrides: Partial<ChatRoomItem>): ChatRoomItem =>
  ({
    id: 5,
    room_type: "public",
    room_key: "public",
    name: "公共聊天室",
    peer: null,
    last_message: "",
    last_message_time: "",
    unread_count: 0,
    ...overrides
  }) as ChatRoomItem;

const message = (overrides: Partial<ChatMessageItem>): ChatMessageItem =>
  ({
    id: 7,
    room_id: 5,
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

let chat: ChatState;
const Host = defineComponent({
  setup() {
    chat = useChat();
    return () => null;
  }
});

const mountChat = () => mount(Host);

const lastFrame = () =>
  JSON.parse(hooks.socketSend.mock.calls.at(-1)![0] as string) as {
    action: string;
    data: Record<string, unknown>;
  };

describe("useChat 编排（子 hook 协同冒烟）", () => {
  beforeEach(() => {
    hooks.socketInstance = { send: hooks.socketSend };
    hooks.connectedValue = true;
  });

  it("genClientMsgId 产出 32 位十六进制幂等键，重复调用不重复", () => {
    const first = genClientMsgId();
    const second = genClientMsgId();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });

  it("装配完成（未选中会话）：只中断流式，不拉历史不上报已读", () => {
    mountChat();
    expect(hooks.abortStream).toHaveBeenCalledTimes(1);
    expect(hooks.loadHistory).not.toHaveBeenCalled();
    expect(hooks.markRead).not.toHaveBeenCalled();
  });

  it("切换会话次序：先中断流式，再拉取历史，最后上报已读", async () => {
    const wrapper = mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);
    await flushPromises();

    expect(hooks.loadHistory).toHaveBeenCalledWith(5);
    expect(hooks.markRead).toHaveBeenCalledWith(5);
    const abortOrder = hooks.abortStream.mock.invocationCallOrder.at(-1)!;
    const historyOrder = hooks.loadHistory.mock.invocationCallOrder.at(-1)!;
    const readOrder = hooks.markRead.mock.invocationCallOrder.at(-1)!;
    expect(abortOrder).toBeLessThan(historyOrder);
    expect(historyOrder).toBeLessThan(readOrder);
    wrapper.unmount();
  });

  it("send 文本：无会话 / 空白内容直接跳过，正常发送先乐观上屏再走 WS 上行", () => {
    mountChat();
    // 未选中会话：不上屏不发帧
    chat.send("hi");
    expect(chat.messages.value).toHaveLength(0);

    chat.rooms.value = [room({})];
    chat.activate(5);
    chat.send("   ");
    expect(chat.messages.value).toHaveLength(0);

    chat.send("  hello  ");
    expect(chat.messages.value).toHaveLength(1);
    const optimistic = chat.messages.value[0];
    const frame = lastFrame();
    expect(optimistic).toMatchObject({
      content: "hello",
      sending: true,
      client_msg_id: frame.data.client_msg_id
    });
    // 乐观气泡未标记失败（等 WS 回执对齐）
    expect(optimistic.failed).toBeFalsy();
    expect(frame.action).toBe(MessageAction.CHAT_MESSAGE);
    expect(frame.data).toMatchObject({ room_id: 5, content: "hello" });
  });

  it("send 断线：乐观气泡标记失败并给出提示", () => {
    hooks.socketInstance = undefined;
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);

    chat.send("hello");

    expect(chat.messages.value[0]).toMatchObject({
      content: "hello",
      sending: false,
      failed: true
    });
    expect(hooks.socketSend).not.toHaveBeenCalled();
    expect(hooks.message).toHaveBeenCalledWith("chat.disconnected", {
      type: "warning"
    });
  });

  it("send 未就绪（重连中 connected=false）：同样失败收口，不把报文交给底层延发", () => {
    hooks.connectedValue = false;
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);

    chat.send("hello");

    expect(chat.messages.value[0]).toMatchObject({ failed: true });
    expect(hooks.socketSend).not.toHaveBeenCalled();
    expect(hooks.message).toHaveBeenCalledWith("chat.disconnected", {
      type: "warning"
    });
  });

  it("send 上行异常（浏览器层抛错）：捕获后标记失败并提示，不产生 uncaught", () => {
    hooks.socketInstance = {
      send: vi.fn(() => {
        throw new Error("InvalidStateError");
      })
    };
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);

    expect(() => chat.send("hello")).not.toThrow();
    expect(chat.messages.value[0]).toMatchObject({ failed: true });
    expect(hooks.message).toHaveBeenCalledWith("chat.disconnected", {
      type: "warning"
    });
  });

  it("resend 文本：复位失败标记并沿用原 client_msg_id 重发（服务端幂等）", () => {
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);
    const item = message({ failed: true, client_msg_id: "c-1" });

    chat.resend(item);

    expect(item.failed).toBe(false);
    expect(item.sending).toBe(true);
    const frame = lastFrame();
    expect(frame.action).toBe(MessageAction.CHAT_MESSAGE);
    expect(frame.data).toMatchObject({
      room_id: 5,
      content: "hello",
      client_msg_id: "c-1"
    });
  });

  it("resend AI 消息：不走 WS，转 AI 流式重发并复位发送态", () => {
    mountChat();
    const byType = message({
      message_type: "ai",
      failed: true,
      client_msg_id: "c-ai-1"
    });
    chat.resend(byType);
    expect(hooks.sendAi).toHaveBeenCalledWith("hello");
    expect(byType.sending).toBe(false);

    const byRoom = message({
      room_type: "ai",
      failed: true,
      client_msg_id: "c-ai-2"
    });
    chat.resend(byRoom);
    expect(hooks.sendAi).toHaveBeenCalledTimes(2);
    expect(hooks.socketSend).not.toHaveBeenCalled();
  });

  it("resend 附件消息：沿用已上传附件引用；缺 file_pk 时保持失败不下发", () => {
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);

    const broken = message({
      message_type: "image",
      failed: true,
      client_msg_id: "c-2",
      extra: {}
    });
    chat.resend(broken);
    expect(broken.failed).toBe(true);
    expect(broken.sending).toBe(false);
    expect(hooks.socketSend).not.toHaveBeenCalled();

    const withFile = message({
      message_type: "image",
      failed: true,
      client_msg_id: "c-3",
      extra: {
        file: {
          pk: "9",
          filename: "pic.png",
          filesize: 1,
          mime_type: "image/png",
          category: "image",
          kind: "image",
          url: "/api/chat/message/7/file",
          missing: false
        }
      }
    });
    chat.resend(withFile);
    const frame = lastFrame();
    expect(frame.action).toBe(MessageAction.CHAT_MESSAGE);
    expect(frame.data).toMatchObject({
      room_id: 5,
      message_type: "image",
      file_pk: "9",
      client_msg_id: "c-3"
    });
  });

  it("recall 成功：服务端确认后本地冻结消息（内容清空、不可再回应）", async () => {
    hooks.recallApi.mockResolvedValue({ code: 1000, detail: "" });
    mountChat();
    chat.upsertMessage(message({ can_recall: true }));

    await chat.recall(chat.messages.value[0]);

    expect(hooks.recallApi).toHaveBeenCalledWith(7);
    expect(chat.messages.value[0]).toMatchObject({
      is_recalled: true,
      content: "",
      can_recall: false
    });
  });

  it("recall 失败：警告提示且不冻结本地消息", async () => {
    hooks.recallApi.mockResolvedValue({ code: 1001, detail: "超过时限" });
    mountChat();
    chat.upsertMessage(message({ can_recall: true }));

    await chat.recall(chat.messages.value[0]);

    expect(hooks.message).toHaveBeenCalledWith("超过时限", { type: "warning" });
    expect(chat.messages.value[0].is_recalled).toBeUndefined();
  });

  it("toggleReaction：自己的回应切换为移除，否则切换为添加", () => {
    mountChat();
    chat.rooms.value = [room({})];
    chat.activate(5);
    chat.me.value = { pk: 2, username: "bob", avatar: "" };
    const item = message({ extra: { reactions: { "👍": [2] } } });

    chat.toggleReaction(item, "👍");
    expect(lastFrame()).toMatchObject({
      action: MessageAction.CHAT_REACTION,
      data: { message: 7, emoji: "👍", op: "remove" }
    });

    chat.me.value = { pk: 1, username: "alice", avatar: "" };
    chat.toggleReaction(item, "👍");
    expect(lastFrame()).toMatchObject({
      action: MessageAction.CHAT_REACTION,
      data: { message: 7, emoji: "👍", op: "add" }
    });
  });

  it("卸载清理：中断流式并断开 WS 连接", () => {
    const wrapper = mountChat();
    wrapper.unmount();
    expect(hooks.abortStream).toHaveBeenCalled();
    expect(hooks.disconnect).toHaveBeenCalled();
  });
});
