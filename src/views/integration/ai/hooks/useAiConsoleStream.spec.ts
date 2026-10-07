import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";

const mocks = vi.hoisted(() => {
  type Events = Record<string, (data?: unknown) => void>;
  let captured: Events | null = null;
  let finish: (() => void) | null = null;
  return {
    askStream: vi.fn(
      (_text: string, events: Events, _signal?: AbortSignal) =>
        new Promise<void>(resolve => {
          captured = events;
          finish = resolve;
        })
    ),
    reset: () => {
      captured = null;
      finish = null;
    },
    emit: (kind: string, data?: unknown) => captured?.[kind]?.(data),
    settle: () => finish?.()
  };
});

vi.mock("@/api/ai/ai", () => ({
  aiAssistantApi: { askStream: mocks.askStream }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { useAiConsoleStream } from "./useAiConsoleStream";

function build() {
  mocks.reset();
  const upsertMessage = vi.fn();
  const stream = useAiConsoleStream({
    t: (key: string) => key,
    feature: ref<AiConsoleFeature>("docs"),
    atBottom: ref(true),
    upsertMessage,
    pushOptimistic: vi.fn(),
    removeOptimistic: vi.fn(),
    scrollToBottom: vi.fn()
  });
  return { upsertMessage, ...stream };
}

describe("useAiConsoleStream 手动中断保留已收增量", () => {
  it("中断时把已累计回答固化为带 partial 标记的本地助手消息", async () => {
    const store = build();
    store.send("第一问");
    mocks.emit("onDelta", "已生成的部分");
    await nextTick();

    store.abortStream();

    expect(store.streaming.value).toBeNull();
    const partial = store.upsertMessage.mock.calls.find(
      ([incoming]) => (incoming as AiConsoleMessage).role === "assistant"
    )?.[0] as AiConsoleMessage | undefined;
    expect(partial).toMatchObject({
      role: "assistant",
      content: "已生成的部分",
      extra: { partial: "ai.streamInterrupted" }
    });
    expect(partial!.id).toBeLessThan(0);

    mocks.settle();
    await flushPromises();
  });

  it("仅收到思考增量时同样固化（content 空、reasoning 保留）", async () => {
    const store = build();
    store.send("第二问");
    mocks.emit("onReasoning", "思考片段");

    store.abortStream();

    const partial = store.upsertMessage.mock.calls.find(
      ([incoming]) => (incoming as AiConsoleMessage).role === "assistant"
    )?.[0] as AiConsoleMessage | undefined;
    expect(partial).toMatchObject({
      content: "",
      reasoning: "思考片段",
      extra: { partial: "ai.streamInterrupted" }
    });

    mocks.settle();
    await flushPromises();
  });

  it("未收到任何增量时中断不留局部消息（与服务端「无增量不落库」口径一致）", async () => {
    const store = build();
    store.send("第三问");
    store.abortStream();

    expect(
      store.upsertMessage.mock.calls.filter(
        ([incoming]) => (incoming as AiConsoleMessage).role === "assistant"
      )
    ).toHaveLength(0);

    mocks.settle();
    await flushPromises();
  });

  it("无进行中流时中断是空操作", () => {
    const store = build();
    store.abortStream();
    expect(store.upsertMessage).not.toHaveBeenCalled();
  });
});
