import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, uploadMock, createSseStreamMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  uploadMock: vi.fn(),
  createSseStreamMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: { request: requestMock, upload: uploadMock }
}));

vi.mock("@/utils/sse", () => ({ createSseStream: createSseStreamMock }));

import { chatApi, streamAiMessage } from "./index";

/**
 * 聊天室 REST 契约：端点 URL 与载荷（WS 收发不在本层）；AI 流式只校验
 * 端点/载荷/中断信号透传，语义帧分发由 utils/sse.spec 统一覆盖。
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

  it("附件：upload 端点与取件地址派生（图片可带 size）", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "pic.png", {
      type: "image/png"
    });
    chatApi.uploadAttachment(file, "image");
    // 走 http.upload（multipart/form-data 专用通道，与文件中心上传同口径）
    const [url, params, form] = uploadMock.mock.calls.at(-1)!;
    expect(url).toBe("/api/chat/message/upload");
    expect(params).toEqual({});
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("kind")).toBe("image");
    expect(((form as FormData).get("file") as File).name).toBe("pic.png");

    expect(chatApi.attachmentUrl(66)).toBe("/api/chat/message/66/file");
    expect(chatApi.attachmentUrl(66, "thumb")).toBe(
      "/api/chat/message/66/file?size=thumb"
    );
    expect(chatApi.attachmentUrl(66, "preview")).toBe(
      "/api/chat/message/66/file?size=preview"
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

describe("streamAiMessage SSE 端点", () => {
  beforeEach(() => {
    requestMock.mockReset();
    createSseStreamMock.mockReset();
  });

  it("URL 指向 AI 流式端点并透传载荷、事件与 signal", () => {
    const controller = new AbortController();
    const events = { onDelta: vi.fn() };
    streamAiMessage({ room_id: 1, content: "hi" }, events, controller.signal);

    expect(createSseStreamMock).toHaveBeenCalledWith(
      "/api/chat/ai/stream",
      { room_id: 1, content: "hi" },
      events,
      controller.signal
    );
  });
});
