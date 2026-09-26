import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, postSseMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  postSseMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock }
}));

vi.mock("@/utils/sse", () => ({ postSse: postSseMock }));

import { chatApi, streamAiMessage } from "./index";

/**
 * 聊天室 REST 契约：端点 URL 与载荷（WS 收发不在本层）；AI 流式的
 * SSE 帧分发（meta/reasoning/delta/done/error + 容错）是本文件唯一
 * 带分支的逻辑，逐帧覆盖。
 */

describe("chatApi 会话与群聊", () => {
  beforeEach(() => requestMock.mockReset());

  it("roomList / openPrivate / createGroup", () => {
    chatApi.roomList();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/chat/room",
      { params: {}, data: {} },
      {}
    );

    chatApi.openPrivate(7);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/room/open-private",
      { params: {}, data: { user_pk: 7 } },
      {}
    );

    chatApi.createGroup({ name: "项目组", member_pks: [2, 3] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/room/create-group",
      { params: {}, data: { name: "项目组", member_pks: [2, 3] } },
      {}
    );
  });

  it("群成员：完整列表 / 变更 / 改名 / 退出", () => {
    chatApi.groupMembers(9);
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/chat/room/9/members",
      { params: {}, data: {} },
      {}
    );

    chatApi.updateGroupMembers(9, { add: [4], remove: [5] });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/room/9/members",
      { params: {}, data: { add: [4], remove: [5] } },
      {}
    );

    chatApi.renameGroup(9, "新名字");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/room/9/rename",
      { params: {}, data: { name: "新名字" } },
      {}
    );

    chatApi.leaveGroup(9);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/room/9/leave",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("chatApi 消息与联系人", () => {
  beforeEach(() => requestMock.mockReset());

  it("searchChatUsers / contacts 查询透传", () => {
    chatApi.searchChatUsers("张");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/chat/contacts/user-options",
      { params: { keyword: "张" }, data: {} },
      {}
    );

    chatApi.contacts({ limit: 20 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/chat/contacts",
      { params: { limit: 20 }, data: {} },
      {}
    );
  });

  it("history 倒序游标参数透传", () => {
    chatApi.history({ room: 1, before_id: 88, limit: 20 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/chat/message",
      { params: { room: 1, before_id: 88, limit: 20 }, data: {} },
      {}
    );
  });

  it("recall / aiMessage", () => {
    chatApi.recall(66);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/message/66/recall",
      { params: {}, data: {} },
      {}
    );

    chatApi.aiMessage({ room_id: 1, content: "hi", client_msg_id: "c1" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/chat/ai/message",
      {
        params: {},
        data: { room_id: 1, content: "hi", client_msg_id: "c1" }
      },
      {}
    );
  });
});

describe("streamAiMessage SSE 帧分发", () => {
  beforeEach(() => {
    requestMock.mockReset();
    postSseMock.mockReset();
  });

  /** 捕获 postSse 收到的 onFrame 回调，模拟服务端推帧 */
  function emit(frame: { event: string; data?: string }) {
    const options = postSseMock.mock.calls[0][2];
    options.onFrame(frame);
  }

  it("URL 指向 AI 流式端点并透传载荷与 signal", () => {
    const controller = new AbortController();
    streamAiMessage({ room_id: 1, content: "hi" }, {}, controller.signal);
    expect(postSseMock).toHaveBeenCalledWith(
      "/api/chat/ai/stream",
      { room_id: 1, content: "hi" },
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("五类事件分发到对应回调", () => {
    const events = {
      onMeta: vi.fn(),
      onReasoning: vi.fn(),
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn()
    };
    streamAiMessage({ content: "hi" }, events);

    emit({ event: "meta", data: '{"question":{"id":1}}' });
    expect(events.onMeta).toHaveBeenCalledWith({ question: { id: 1 } });

    emit({ event: "reasoning", data: '{"delta":"思考"}' });
    expect(events.onReasoning).toHaveBeenCalledWith("思考");

    emit({ event: "delta", data: '{"delta":"回答"}' });
    expect(events.onDelta).toHaveBeenCalledWith("回答");

    emit({
      event: "done",
      data: '{"mode":"chat","message":{"id":2}}'
    });
    expect(events.onDone).toHaveBeenCalledWith({
      mode: "chat",
      message: { id: 2 }
    });

    emit({ event: "error", data: '{"detail":"boom"}' });
    expect(events.onError).toHaveBeenCalledWith({
      detail: "boom",
      message: undefined
    });
  });

  it("坏 JSON 与空帧静默忽略，delta 缺省为空串", () => {
    const events = {
      onMeta: vi.fn(),
      onReasoning: vi.fn(),
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn()
    };
    streamAiMessage({ content: "hi" }, events);

    expect(() => emit({ event: "delta", data: "{bad json" })).not.toThrow();
    expect(events.onDelta).not.toHaveBeenCalled();

    emit({ event: "delta" });
    expect(events.onDelta).toHaveBeenCalledWith("");

    emit({ event: "unknown", data: '{"x":1}' });
    expect(events.onMeta).not.toHaveBeenCalled();
    expect(events.onDone).not.toHaveBeenCalled();
    expect(events.onError).not.toHaveBeenCalled();
  });
});
