import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { ChatMessageItem } from "@/api/chat";

const { historyMock } = vi.hoisted(() => ({ historyMock: vi.fn() }));

vi.mock("@/api/chat", () => ({ chatApi: { history: historyMock } }));

import { useChatHistory } from "./useChatHistory";

/** 历史消息样本（服务端返回按时间正序） */
const message = (id: number): ChatMessageItem =>
  ({
    id,
    room_id: 1,
    room_type: "public",
    sender_pk: 2,
    sender_name: "alice",
    sender_avatar: "",
    message_type: "text",
    content: `m${id}`,
    created_time: "2026-10-02T00:00:00Z",
    client_msg_id: "",
    extra: {}
  }) as ChatMessageItem;

const page = (ids: number[], hasMore: boolean) => ({
  code: 1000,
  data: { results: ids.map(message), has_more: hasMore }
});

function build(initial: ChatMessageItem[] = []) {
  const messages = ref<ChatMessageItem[]>(initial);
  const activeRoomId = ref(1);
  /** 假滚动容器：scrollHeight 可变（模拟向上插入历史后内容长高） */
  const container: { scrollTop: number; scrollHeight: number } = {
    scrollTop: 0,
    scrollHeight: 1000
  };
  const scroller = ref(container as HTMLElement);
  const pendingCount = ref(0);
  const scrollToBottom = vi.fn();
  const history = useChatHistory({
    messages,
    activeRoomId,
    scroller,
    pendingCount,
    scrollToBottom
  });
  return {
    messages,
    activeRoomId,
    container,
    scroller,
    pendingCount,
    scrollToBottom,
    ...history
  };
}

describe("useChatHistory before_id 游标分页", () => {
  beforeEach(() => {
    historyMock.mockReset();
  });

  it("loadHistory 以 limit=20 拉取并整表替换，hasMore 随响应翻转", async () => {
    historyMock.mockResolvedValue(page([11, 12], true));
    const ctx = build();
    const pending = ctx.loadHistory(1);
    expect(ctx.loadingHistory.value).toBe(true);
    await pending;
    expect(historyMock).toHaveBeenCalledWith({ room: 1, limit: 20 });
    expect(ctx.messages.value.map(item => item.id)).toEqual([11, 12]);
    expect(ctx.hasMore.value).toBe(true);
    expect(ctx.loadingHistory.value).toBe(false);
    expect(ctx.pendingCount.value).toBe(0);
    expect(ctx.scrollToBottom).toHaveBeenCalled();
  });

  it("loadHistory 业务失败时保持空表且无更多，仍定位到底部", async () => {
    historyMock.mockResolvedValue({ code: 1001, detail: "无权限" });
    const ctx = build();
    await ctx.loadHistory(1);
    expect(ctx.messages.value).toEqual([]);
    expect(ctx.hasMore.value).toBe(false);
    expect(ctx.loadingHistory.value).toBe(false);
    expect(ctx.scrollToBottom).toHaveBeenCalled();
  });

  it("loadMore 以首条消息 id 作 before_id 前插旧页，并按高度差补偿 scrollTop", async () => {
    const ctx = build([message(11), message(12)]);
    historyMock.mockImplementation(() => {
      // 响应到达时内容已长高 300px（模拟旧页插入渲染后的新高度）
      ctx.container.scrollHeight = 1300;
      return Promise.resolve(page([9, 10], false));
    });
    ctx.hasMore.value = true;
    ctx.container.scrollTop = 200;

    await ctx.loadMore();

    expect(historyMock).toHaveBeenCalledWith({
      room: 1,
      before_id: 11,
      limit: 20
    });
    // 旧页整段前插，既有消息顺序不动
    expect(ctx.messages.value.map(item => item.id)).toEqual([9, 10, 11, 12]);
    expect(ctx.hasMore.value).toBe(false);
    // 视觉位置保持：scrollTop 补回新增内容的高度差
    expect(ctx.container.scrollTop).toBe(500);
    expect(ctx.loadingMore.value).toBe(false);
  });

  it("loadMore 进行中再次触发被互斥拦下，不产生重复请求", async () => {
    const ctx = build([message(11)]);
    ctx.hasMore.value = true;
    let resolvePage!: (value: ReturnType<typeof page>) => void;
    historyMock.mockImplementation(
      () => new Promise(resolve => (resolvePage = resolve))
    );

    const first = ctx.loadMore();
    expect(ctx.loadingMore.value).toBe(true);
    await ctx.loadMore();
    expect(historyMock).toHaveBeenCalledTimes(1);

    resolvePage(page([9], false));
    await first;
    expect(ctx.loadingMore.value).toBe(false);
    expect(ctx.messages.value.map(item => item.id)).toEqual([9, 11]);
  });

  it("loadMore 守卫：无更多 / 集合为空 / 首条为乐观占位时不发请求", async () => {
    const noMore = build([message(11)]);
    noMore.hasMore.value = false;
    await noMore.loadMore();

    const empty = build();
    empty.hasMore.value = true;
    await empty.loadMore();

    const optimisticHead = build([message(-5)]);
    optimisticHead.hasMore.value = true;
    await optimisticHead.loadMore();

    expect(historyMock).not.toHaveBeenCalled();
  });

  it("loadMore 业务失败：列表与 hasMore 原样保留，loadingMore 复位", async () => {
    historyMock.mockResolvedValue({ code: 1001, detail: "失败" });
    const ctx = build([message(11)]);
    ctx.hasMore.value = true;

    await ctx.loadMore();

    expect(ctx.messages.value.map(item => item.id)).toEqual([11]);
    expect(ctx.hasMore.value).toBe(true);
    expect(ctx.loadingMore.value).toBe(false);
  });
});
