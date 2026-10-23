import { afterEach, describe, expect, it, vi } from "vitest";
import { createSseStream } from "./sse";

/** 最小 fetch 响应桩：仅覆盖 postSse 用到的 headers/body 读取 */
function sseResponse(chunks: string[]) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "text/event-stream" },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true, value: undefined }
      })
    }
  };
}

function stubFetch(chunks: string[]) {
  const fetchMock = vi.fn(async () => sseResponse(chunks));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createSseStream 语义帧分派", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("按 meta → reasoning* → delta* → done 顺序分发（含跨分片半帧）", async () => {
    const frames = [
      'event: meta\ndata: {"question":{"id":1}}\n\n',
      'event: reasoning\ndata: {"delta":"先"}\n\n',
      'event: reasoning\ndata: {"delta":"想"}\n\n',
      'event: delta\ndata: {"delta":"答"}\n\n',
      'event: delta\ndata: {"delta":"案"}\n\n',
      'event: done\ndata: {"mode":"chat","message":{"id":2}}\n\n'
    ].join("");
    stubFetch([frames.slice(0, 19), frames.slice(19, 71), frames.slice(71)]);

    const calls: string[] = [];
    await createSseStream<
      { mode: string; message: { id: number } },
      { question: { id: number } }
    >(
      "/api/chat/ai/stream",
      { content: "hi" },
      {
        onMeta: data => calls.push(`meta:${data.question.id}`),
        onReasoning: delta => calls.push(`reasoning:${delta}`),
        onDelta: delta => calls.push(`delta:${delta}`),
        onDone: data => calls.push(`done:${data.mode}:${data.message.id}`)
      }
    );

    expect(calls).toEqual([
      "meta:1",
      "reasoning:先",
      "reasoning:想",
      "delta:答",
      "delta:案",
      "done:chat:2"
    ]);
  });

  it("done 载荷原样透传", async () => {
    stubFetch([
      'event: done\ndata: {"answer":"答案","sources":[{"title":"文档"}]}\n\n'
    ]);
    const onDone = vi.fn();

    await createSseStream<{
      answer: string;
      sources: { title: string }[];
    }>("/api/ai/assistant/ask/stream", { question: "q" }, { onDone });

    expect(onDone).toHaveBeenCalledWith({
      answer: "答案",
      sources: [{ title: "文档" }]
    });
  });

  it("error 帧进入 error 分支并透传 detail/message", async () => {
    stubFetch([
      'event: error\ndata: {"detail":"模型不可用","message":{"id":3}}\n\n'
    ]);
    const onError = vi.fn();
    const onDone = vi.fn();

    await createSseStream<
      unknown,
      Record<string, unknown>,
      { detail: string; message: { id: number } }
    >("/api/chat/ai/stream", {}, { onError, onDone });

    expect(onError).toHaveBeenCalledWith({
      detail: "模型不可用",
      message: { id: 3 }
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("非法 JSON / 空帧静默忽略，delta 缺省为空串", async () => {
    stubFetch([
      "event: delta\ndata: {bad json\n\n",
      "event: delta\n\n",
      'event: unknown\ndata: {"x":1}\n\n'
    ]);
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onMeta = vi.fn();

    await expect(
      createSseStream("/api/chat/ai/stream", {}, { onDelta, onDone, onMeta })
    ).resolves.toBeUndefined();

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith("");
    expect(onMeta).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
