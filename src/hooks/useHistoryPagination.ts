import { nextTick, ref, type Ref } from "vue";

/** 历史分页每页条数（两线同口径：首屏与上翻各取 20 条） */
const PAGE_SIZE = 20;

/** 一页历史结果。null 表示业务失败：本层不改写既有集合与 hasMore。 */
export interface HistoryPage<T> {
  results: T[];
  hasMore: boolean;
}

/**
 * 消息历史分页共享层（聊天室 / AI 控制台共用）：before_id 游标向上翻页，
 * 保留滚动位置。消息数组与滚动状态由调用方持有，本层只负责拉取与拼接；
 * 域差异（按房间 / 按入口的端点与参数）经 fetchPage 注入，业务成功码的判定
 * 也在 fetchPage 内完成（成功返回数据面，失败返回 null）。
 */
export function useHistoryPagination<T extends { id: number }, Scope = void>({
  messages,
  scroller,
  pendingCount,
  scrollToBottom,
  fetchPage,
  scopeForLoadMore
}: {
  messages: Ref<T[]>;
  scroller: Ref<HTMLElement | null>;
  pendingCount: Ref<number>;
  scrollToBottom: () => void;
  /** 拉取一页：initial 为首屏整表替换，否则以 before_id 游标前插旧页 */
  fetchPage: (
    query: { beforeId?: number; limit: number; initial: boolean },
    scope: Scope
  ) => Promise<HistoryPage<T> | null>;
  /** 上翻页时的域上下文（聊天室取当前会话，助手页取当前入口） */
  scopeForLoadMore: () => Scope;
}) {
  const hasMore = ref(false);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);

  async function loadHistory(scope: Scope) {
    loadingHistory.value = true;
    messages.value = [];
    pendingCount.value = 0;
    try {
      const page = await fetchPage({ limit: PAGE_SIZE, initial: true }, scope);
      if (page) {
        messages.value = page.results;
        hasMore.value = page.hasMore;
      }
    } finally {
      loadingHistory.value = false;
    }
    await nextTick();
    scrollToBottom();
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || !messages.value.length) return;
    const firstId = messages.value[0]?.id;
    if (!firstId || firstId < 0) return;
    loadingMore.value = true;
    const container = scroller.value;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    try {
      const page = await fetchPage(
        { beforeId: firstId, limit: PAGE_SIZE, initial: false },
        scopeForLoadMore()
      );
      if (page) {
        messages.value = [...page.results, ...messages.value];
        hasMore.value = page.hasMore;
        await nextTick();
        // 保持视觉位置：新增内容的高度差补回 scrollTop
        if (container) {
          container.scrollTop =
            previousTop + (container.scrollHeight - previousHeight);
        }
      }
    } finally {
      loadingMore.value = false;
    }
  }

  return { hasMore, loadingHistory, loadingMore, loadHistory, loadMore };
}
