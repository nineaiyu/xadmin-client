import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";

const { historyMock } = vi.hoisted(() => ({ historyMock: vi.fn() }));

vi.mock("@/api/ai/ai", () => ({ aiAssistantApi: { history: historyMock } }));

import { useAiConsoleHistory } from "./useAiConsoleHistory";

/** 助手消息样本（服务端持久化契约，时间正序返回） */
const consoleMessage = (id: number, role = "assistant"): AiConsoleMessage =>
  ({
    id,
    feature: "docs",
    role,
    content: `m${id}`,
    reasoning: "",
    extra: {},
    created_time: "2026-10-02T00:00:00Z"
  }) as AiConsoleMessage;

const page = (ids: number[], hasMore: boolean) => ({
  code: 1000,
  data: { results: ids.map(id => consoleMessage(id)), has_more: hasMore }
});

function build(
  initial: AiConsoleMessage[] = [],
  feature: AiConsoleFeature = "docs"
) {
  const featureRef = ref(feature);
  const messages = ref<AiConsoleMessage[]>(initial);
  const container: { scrollTop: number; scrollHeight: number } = {
    scrollTop: 0,
    scrollHeight: 1000
  };
  const scroller = ref(container as HTMLElement);
  const pendingCount = ref(0);
  const scrollToBottom = vi.fn();
  const history = useAiConsoleHistory({
    feature: featureRef,
    messages,
    scroller,
    pendingCount,
    scrollToBottom
  });
  return {
    feature: featureRef,
    messages,
    container,
    scroller,
    pendingCount,
    scrollToBottom,
    ...history
  };
}

describe("useAiConsoleHistory before_id 游标分页", () => {
  beforeEach(() => {
    historyMock.mockReset();
  });

  it("loadHistory 按当前入口拉取最近一页并整表替换，hasMore 随响应翻转", async () => {
    historyMock.mockResolvedValue(page([31, 32], true));
    const ctx = build([], "nl");
    const pending = ctx.loadHistory();
    expect(ctx.loadingHistory.value).toBe(true);
    await pending;
    expect(historyMock).toHaveBeenCalledWith({ feature: "nl", limit: 20 });
    expect(ctx.messages.value.map(item => item.id)).toEqual([31, 32]);
    expect(ctx.hasMore.value).toBe(true);
    expect(ctx.loadingHistory.value).toBe(false);
    expect(ctx.pendingCount.value).toBe(0);
    expect(ctx.scrollToBottom).toHaveBeenCalled();
  });

  it("loadMore 以首条消息 id 作 before_id 前插旧页，并按高度差补偿 scrollTop", async () => {
    const ctx = build([consoleMessage(33), consoleMessage(34)]);
    historyMock.mockImplementation(() => {
      ctx.container.scrollHeight = 1250;
      return Promise.resolve(page([31, 32], true));
    });
    ctx.hasMore.value = true;
    ctx.container.scrollTop = 150;

    await ctx.loadMore();

    expect(historyMock).toHaveBeenCalledWith({
      feature: "docs",
      before_id: 33,
      limit: 20
    });
    expect(ctx.messages.value.map(item => item.id)).toEqual([31, 32, 33, 34]);
    expect(ctx.hasMore.value).toBe(true);
    expect(ctx.container.scrollTop).toBe(400);
    expect(ctx.loadingMore.value).toBe(false);
  });

  it("loadMore 进行中互斥；守卫（无更多/空表/乐观占位居首）不发请求", async () => {
    // 互斥：进行中再触发不重复请求
    const ctx = build([consoleMessage(33)]);
    ctx.hasMore.value = true;
    let resolvePage!: (value: ReturnType<typeof page>) => void;
    historyMock.mockImplementation(
      () => new Promise(resolve => (resolvePage = resolve))
    );
    const first = ctx.loadMore();
    expect(ctx.loadingMore.value).toBe(true);
    await ctx.loadMore();
    expect(historyMock).toHaveBeenCalledTimes(1);
    resolvePage(page([31], false));
    await first;
    expect(ctx.loadingMore.value).toBe(false);

    // 守卫：无更多 / 空表 / 首条为负 id 乐观占位
    historyMock.mockClear();
    const noMore = build([consoleMessage(33)]);
    noMore.hasMore.value = false;
    await noMore.loadMore();

    const empty = build();
    empty.hasMore.value = true;
    await empty.loadMore();

    const optimistic = build([{ ...consoleMessage(-9, "user"), id: -9 }]);
    optimistic.hasMore.value = true;
    await optimistic.loadMore();

    expect(historyMock).not.toHaveBeenCalled();
  });

  it("loadHistory 业务失败：保持空表且 loadingHistory 复位", async () => {
    historyMock.mockResolvedValue({ code: 1001, detail: "失败" });
    const ctx = build();
    await ctx.loadHistory();
    expect(ctx.messages.value).toEqual([]);
    expect(ctx.hasMore.value).toBe(false);
    expect(ctx.loadingHistory.value).toBe(false);
  });
});
