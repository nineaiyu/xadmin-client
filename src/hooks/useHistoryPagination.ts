import { nextTick, ref, type Ref } from "vue";
import { bindMessageWindow } from "@/components/ChatMessageList/messageWindow";

/** 历史分页每页条数（两线同口径：首屏与上翻各取 20 条） */
const PAGE_SIZE = 20;

/** 一页历史结果。null 表示业务失败：本层不改写既有集合与 hasMore。 */
export interface HistoryPage<T> {
  results: T[];
  hasMore: boolean;
}

/**
 * 消息历史分页共享层（聊天室 / AI 控制台共用）：before_id 游标向上翻页，
 * 保留滚动位置；超长会话在数据层裁剪到最近 N 条，避免消息行无界堆积。
 * 消息数组与滚动状态由调用方持有，本层只负责拉取与拼接（域差异经 fetchPage 注入，
 * 业务成功码的判定也在 fetchPage 内完成：成功返回数据面，失败返回 null）。
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
  /** 首屏历史加载失败（业务码失败或网络异常）：空态文案必须与「确实没有消息」区分 */
  const loadFailed = ref(false);

  /** 首屏历史请求令牌：只允许最新一次 loadHistory 回填 */
  let historySeq = 0;
  bindMessageWindow({ messages, scroller, loadingMore, scrollToBottom });

  async function loadHistory(scope: Scope) {
    const seq = ++historySeq;
    loadingHistory.value = true;
    loadFailed.value = false;
    messages.value = [];
    pendingCount.value = 0;
    try {
      const page = await fetchPage({ limit: PAGE_SIZE, initial: true }, scope);
      // 过期响应直接丢弃：快速 A→B 切会话时，A 的慢响应不得把 A 的历史写进
      // B 的消息区（loadMore 有 scopeForLoadMore 守卫，首屏此前没有）
      if (seq !== historySeq) return;
      if (page) {
        messages.value = page.results;
        hasMore.value = page.hasMore;
      } else {
        loadFailed.value = true;
      }
    } catch {
      // 网络异常不逃逸出 loadHistory（调用方无 catch 会成为 unhandled rejection）；
      // 错误提示由 http 层统一给出，这里只记录失败态供空态文案区分
      if (seq === historySeq) loadFailed.value = true;
    } finally {
      if (seq === historySeq) {
        loadingHistory.value = false;
      }
    }
    if (seq !== historySeq) return;
    await nextTick();
    scrollToBottom();
  }

  async function loadMore() {
    if (!hasMore.value || loadingMore.value || !messages.value.length) return;
    const firstId = messages.value[0]?.id;
    if (!firstId || firstId < 0) return;
    loadingMore.value = true;
    const seq = historySeq;
    const container = scroller.value;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    try {
      const page = await fetchPage(
        { beforeId: firstId, limit: PAGE_SIZE, initial: false },
        scopeForLoadMore()
      );
      // 切会话后 loadHistory 已递增 historySeq：A 房的慢响应不得前插进 B 房。
      if (seq !== historySeq) return;
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

  return {
    hasMore,
    loadingHistory,
    loadingMore,
    loadFailed,
    loadHistory,
    loadMore
  };
}
