import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useHistoryPagination } from "./useHistoryPagination";

type Message = { id: number };
type FetchPage = (
  query: { beforeId?: number; limit: number; initial: boolean },
  scope: string
) => Promise<{ results: Message[]; hasMore: boolean } | null>;

function setup(fetchPage: FetchPage) {
  const messages = ref<Message[]>([]);
  const pendingCount = ref(3);
  const scroller = ref<HTMLElement | null>(null);
  const scrollToBottom = vi.fn();
  const pagination = useHistoryPagination<Message, string>({
    messages,
    scroller,
    pendingCount,
    scrollToBottom,
    fetchPage,
    scopeForLoadMore: () => "room-1"
  });
  return {
    ...pagination,
    messages,
    pendingCount,
    scrollToBottom
  };
}

const page = (ids: number[], hasMore: boolean) => ({
  results: ids.map(id => ({ id })),
  hasMore
});

describe("useHistoryPagination", () => {
  it("首屏替换消息并复位待读计数", async () => {
    const fetchPage = vi.fn<FetchPage>().mockResolvedValue(page([3, 4], true));
    const { loadHistory, messages, hasMore, pendingCount, scrollToBottom } =
      setup(fetchPage);
    await loadHistory("room-1");
    expect(fetchPage).toHaveBeenCalledWith(
      { limit: 20, initial: true },
      "room-1"
    );
    expect(messages.value.map(item => item.id)).toEqual([3, 4]);
    expect(hasMore.value).toBe(true);
    expect(pendingCount.value).toBe(0);
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it("过期首屏响应被丢弃：切会话后旧会话慢响应不写入（FE-DATA-P1-04）", async () => {
    let resolveA: (value: ReturnType<typeof page>) => void = () => undefined;
    const fetchPage = vi
      .fn<FetchPage>()
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveA = resolve;
          })
      )
      .mockResolvedValueOnce(page([11], false));
    const { loadHistory, messages, scrollToBottom } = setup(fetchPage);

    const slow = loadHistory("room-a");
    await loadHistory("room-b");
    expect(messages.value.map(item => item.id)).toEqual([11]);

    // A 的响应后到：不得覆盖 B 的消息，也不得触发滚动
    resolveA(page([3, 4], true));
    await slow;
    expect(messages.value.map(item => item.id)).toEqual([11]);
    expect(scrollToBottom).toHaveBeenCalledTimes(1);
  });

  it("上翻按首条 id 作游标前插旧页并更新 hasMore", async () => {
    const fetchPage = vi
      .fn<FetchPage>()
      .mockResolvedValueOnce(page([5, 6], true))
      .mockResolvedValueOnce(page([1, 2], false));
    const { loadHistory, loadMore, messages, hasMore } = setup(fetchPage);
    await loadHistory("room-1");
    await loadMore();
    expect(fetchPage).toHaveBeenLastCalledWith(
      { beforeId: 5, limit: 20, initial: false },
      "room-1"
    );
    expect(messages.value.map(item => item.id)).toEqual([1, 2, 5, 6]);
    expect(hasMore.value).toBe(false);
  });

  it("无更多 / 空消息 / 加载中不重复请求", async () => {
    const fetchPage = vi.fn<FetchPage>().mockResolvedValue(page([], false));
    const { loadHistory, loadMore } = setup(fetchPage);
    await loadHistory("room-1");
    await loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
