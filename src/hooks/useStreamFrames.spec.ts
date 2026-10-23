import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { message } from "@/utils/message";
import { buildStreamHandlers } from "./useStreamFrames";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

function setup(atBottomValue = true) {
  const streaming = ref<{ content: string; reasoning: string } | null>({
    content: "",
    reasoning: ""
  });
  const atBottom = ref(atBottomValue);
  const scrollToBottom = vi.fn();
  const upsertMessage = vi.fn();
  const handlers = buildStreamHandlers<
    { content: string; reasoning: string },
    { id: number }
  >({
    streaming,
    atBottom,
    scrollToBottom,
    upsertMessage,
    metaIncoming: data =>
      (data as { question?: { id: number } } | undefined)?.question,
    doneIncoming: data =>
      (data as { message?: { id: number } } | undefined)?.message,
    errorIncoming: data =>
      (data as { message?: { id: number } } | undefined)?.message
  });
  return { streaming, atBottom, scrollToBottom, upsertMessage, handlers };
}

describe("buildStreamHandlers 上层累计与 upsert", () => {
  it("reasoning/delta 增量累计并贴底滚动，终止帧不追加增量", () => {
    const { streaming, scrollToBottom, upsertMessage, handlers } = setup();

    handlers.onReasoning("先");
    handlers.onReasoning("想");
    handlers.onDelta("答");
    handlers.onDelta("案");
    handlers.onDone({ message: { id: 9 } });

    expect(streaming.value).toEqual({
      content: "答案",
      reasoning: "先想"
    });
    expect(scrollToBottom).toHaveBeenCalledTimes(4);
    expect(upsertMessage).toHaveBeenCalledWith({ id: 9 });
  });

  it("离底时不抢滚动", () => {
    const { scrollToBottom, handlers } = setup(false);

    handlers.onReasoning("想");
    handlers.onDelta("答");

    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it("streaming 已复位时增量丢弃", () => {
    const { streaming, scrollToBottom, handlers } = setup();
    streaming.value = null;

    handlers.onReasoning("想");
    handlers.onDelta("答");

    expect(streaming.value).toBeNull();
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it("meta/done 帧经 resolver upsert，无消息载荷时跳过", () => {
    const { upsertMessage, handlers } = setup();

    handlers.onMeta({ question: { id: 1 } });
    handlers.onMeta({});
    handlers.onDone({ message: { id: 2 } });
    handlers.onDone(undefined);

    expect(upsertMessage).toHaveBeenCalledTimes(2);
    expect(upsertMessage).toHaveBeenNthCalledWith(1, { id: 1 });
    expect(upsertMessage).toHaveBeenNthCalledWith(2, { id: 2 });
  });

  it("error 帧 upsert 失败降级消息并提示详情", () => {
    vi.mocked(message).mockClear();
    const { upsertMessage, handlers } = setup();

    handlers.onError({ detail: "模型不可用", message: { id: 3 } });

    expect(upsertMessage).toHaveBeenCalledWith({ id: 3 });
    expect(message).toHaveBeenCalledWith("模型不可用", { type: "warning" });
  });
});
