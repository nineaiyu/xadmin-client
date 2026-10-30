import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock, createSseStreamMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  createSseStreamMock: vi.fn()
}));

vi.mock("@/utils/http", () => ({
  http: {
    request: requestMock,
    upload: vi.fn(),
    autoDownload: vi.fn(),
    download: vi.fn()
  }
}));

vi.mock("@/utils/sse", () => ({
  createSseStream: createSseStreamMock
}));

import { aiAssistantApi, aiProfileApi, listAiProfileRows } from "./ai";

/**
 * api/ai 薄封装契约测试：逐方法断言「方法 + URL + 载荷」，SSE 流断言
 * 「URL + 请求体 + 事件透传」——URL 拼错 / 载荷形态漂移时在构建期变红；
 * 语义帧分发由 utils/sse.spec 统一覆盖。
 */

describe("aiProfileApi 档案管理", () => {
  beforeEach(() => {
    requestMock.mockClear();
    createSseStreamMock.mockClear();
  });

  it("activate / deactivate / test 均为 POST 动作端点", () => {
    aiProfileApi.activate("p1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/profiles/p1/activate",
      { params: {}, data: {} },
      {}
    );
    aiProfileApi.deactivate("p1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/profiles/p1/deactivate",
      { params: {}, data: {} },
      {}
    );
    aiProfileApi.test("p1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/profiles/p1/test",
      { params: {}, data: {} },
      {}
    );
  });

  it("testResult 按 task_id 回读连通性结论（GET 查询参数）", () => {
    aiProfileApi.testResult("p1", "t-1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/profiles/p1/test-result",
      { params: { task_id: "t-1" }, data: {} },
      {}
    );
  });

  it("probe 透传能力探测载荷（缺省空对象）", () => {
    aiProfileApi.probe("p1", { capabilities: ["json"], vision: true });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/profiles/p1/probe",
      { params: {}, data: { capabilities: ["json"], vision: true } },
      {}
    );
    aiProfileApi.probe("p1");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/profiles/p1/probe",
      { params: {}, data: {} },
      {}
    );
  });
});

describe("aiAssistantApi 助手端点", () => {
  beforeEach(() => {
    requestMock.mockClear();
    createSseStreamMock.mockClear();
  });

  it("status / tools 无参 GET", () => {
    aiAssistantApi.status();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/status",
      { params: {}, data: {} },
      {}
    );
    aiAssistantApi.tools();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/tools",
      { params: {}, data: {} },
      {}
    );
  });

  it("metrics / usage 天数缺省与空 feature 被 formatParams 剔除", () => {
    aiAssistantApi.metrics();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/metrics",
      {
        params: { days: 30 },
        data: {}
      },
      {}
    );
    aiAssistantApi.usage();
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/usage",
      {
        params: { days: 7 },
        data: {}
      },
      {}
    );
    aiAssistantApi.usage(14, "nl");
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/usage",
      {
        params: { days: 14, feature: "nl" },
        data: {}
      },
      {}
    );
  });

  it("ask / nlInterpret / nlRun 载荷形态", () => {
    aiAssistantApi.ask("怎么部署");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/assistant/ask",
      {
        params: {},
        data: { question: "怎么部署" }
      },
      {}
    );
    aiAssistantApi.nlInterpret("近 7 天登录数");
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/assistant/nl-query/interpret",
      { params: {}, data: { question: "近 7 天登录数" } },
      {}
    );
    const dsl = { dataset: "d1", mode: "rows", filters: [], limit: 10 };
    aiAssistantApi.nlRun(dsl);
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/assistant/nl-query/run",
      {
        params: {},
        data: { dsl }
      },
      {}
    );
  });

  it("history 透传分页参数（before_id 可选）", () => {
    aiAssistantApi.history({ feature: "docs" });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/history",
      {
        params: { feature: "docs" },
        data: {}
      },
      {}
    );
    aiAssistantApi.history({ feature: "action", before_id: 9, limit: 20 });
    expect(requestMock).toHaveBeenLastCalledWith(
      "get",
      "/api/ai/assistant/history",
      {
        params: { feature: "action", before_id: 9, limit: 20 },
        data: {}
      },
      {}
    );
  });

  it("actionExecute 提交确认后的动作草稿（含聊天上下文可选字段）", () => {
    aiAssistantApi.actionExecute({
      action: "user.search",
      params: { keyword: "a" }
    });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/assistant/action/execute",
      { params: {}, data: { action: "user.search", params: { keyword: "a" } } },
      {}
    );
    aiAssistantApi.actionExecute({
      action: "role.create",
      params: { name: "r" },
      room_id: 1,
      message_id: 2
    });
    expect(requestMock).toHaveBeenLastCalledWith(
      "post",
      "/api/ai/assistant/action/execute",
      {
        params: {},
        data: {
          action: "role.create",
          params: { name: "r" },
          room_id: 1,
          message_id: 2
        }
      },
      {}
    );
  });
});

describe("AI SSE 流式端点契约", () => {
  beforeEach(() => {
    requestMock.mockClear();
    createSseStreamMock.mockClear();
  });

  function sseEvents() {
    return {
      onMeta: vi.fn(),
      onReasoning: vi.fn(),
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn()
    };
  }

  it("askStream POST SSE 端点携带 question，并透传事件与 signal", () => {
    const events = sseEvents();
    const controller = new AbortController();
    aiAssistantApi.askStream("你好", events, controller.signal);

    expect(createSseStreamMock).toHaveBeenCalledWith(
      "/api/ai/assistant/ask/stream",
      { question: "你好" },
      events,
      controller.signal
    );
  });

  it("nlInterpretStream / actionInterpretStream 端点与载荷", () => {
    const events = sseEvents();
    aiAssistantApi.nlInterpretStream("近 7 天登录", events);
    expect(createSseStreamMock.mock.calls[0][0]).toBe(
      "/api/ai/assistant/nl-query/interpret/stream"
    );
    expect(createSseStreamMock.mock.calls[0][1]).toEqual({
      question: "近 7 天登录"
    });

    aiAssistantApi.actionInterpretStream("帮我把用户 a 禁用", events);
    expect(createSseStreamMock.mock.calls[1][0]).toBe(
      "/api/ai/assistant/action/interpret/stream"
    );
    expect(createSseStreamMock.mock.calls[1][1]).toEqual({
      message: "帮我把用户 a 禁用"
    });
  });

  it("listAiProfileRows 拆包 data.results 并容忍空壳", () => {
    const rows = [{ pk: "1" }, { pk: "2" }];
    expect(listAiProfileRows({ data: { results: rows } })).toEqual(rows);
    expect(listAiProfileRows({})).toEqual([]);
    expect(listAiProfileRows(undefined)).toEqual([]);
  });
});
