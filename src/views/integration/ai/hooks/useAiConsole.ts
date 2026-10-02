import { ref, watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  aiAssistantApi,
  type AiActionDraft,
  type AiConsoleFeature
} from "@/api/ai/ai";
import { useAiConsoleScroll } from "./useAiConsoleScroll";
import { useAiConsoleMessages, toIncoming } from "./useAiConsoleMessages";
import { useAiConsoleHistory } from "./useAiConsoleHistory";
import { useAiConsoleStream } from "./useAiConsoleStream";

type ExecuteResponse = {
  code: number;
  data: unknown;
  detail?: string;
  type?: string;
};

/**
 * AI 助手控制台状态（左右分栏三入口：文档问答 / 数据查询 / 指令执行）。
 *
 * - 消息持久化在服务端（AiChatMessage）：进入/切换入口拉取最近一页，
 *   `before_id` 向上翻页；流式 done/error 携带服务端载荷，乐观上屏按载荷对齐，
 *   刷新后从历史端点得到同一份数据（本地不另造展示格式）；
 * - 三个入口各自独立的持久化消息流，同一时刻只允许一路流式生成。
 *
 * 职责拆分（状态由本 hook 持有，子模块经 options 注入）：
 * - useAiConsoleScroll    离底检测 / 新消息计数 / 滚动定位；
 * - useAiConsoleMessages  消息集合（乐观上屏对齐）+ toIncoming 载荷校验；
 * - useAiConsoleHistory   历史分页（before_id 游标、滚动位置保持）；
 * - useAiConsoleStream    流式发送（三入口共用帧分派）与中断。
 */
export function useAiConsole() {
  const { t } = useI18n();

  const feature = ref<AiConsoleFeature>("docs");

  // ------------------------------------------------------------------ 滚动

  const { scroller, atBottom, pendingCount, scrollToBottom, onScroll } =
    useAiConsoleScroll();

  // ------------------------------------------------------------------ 消息集合

  const {
    messages,
    messageGroups,
    upsertMessage,
    pushOptimistic,
    removeOptimistic
  } = useAiConsoleMessages({
    feature,
    atBottom,
    pendingCount,
    scrollToBottom
  });

  // ------------------------------------------------------------------ 历史

  const { hasMore, loadingHistory, loadingMore, loadHistory, loadMore } =
    useAiConsoleHistory({
      feature,
      messages,
      scroller,
      pendingCount,
      scrollToBottom
    });

  // ------------------------------------------------------------------ 流式发送

  const { streaming, activeStreaming, send, abortStream } = useAiConsoleStream({
    t,
    feature,
    atBottom,
    upsertMessage,
    pushOptimistic,
    removeOptimistic,
    scrollToBottom
  });

  // ------------------------------------------------------------------ 执行类操作

  /** NL 查询运行中（运行按钮 loading） */
  const nlRunning = ref(false);

  /** 运行 NL 查询：服务端重校验 + 结果消息落库，载荷回传后上屏 */
  async function runNl(dsl: object): Promise<boolean> {
    if (nlRunning.value) return false;
    nlRunning.value = true;
    try {
      const res = (await aiAssistantApi
        .nlRun(dsl)
        .catch((error: { detail?: string }) => ({
          code: -1,
          data: null,
          detail: String(error?.detail ?? error)
        }))) as ExecuteResponse;
      if (res.code === SUCCESS_CODE && res.data) {
        const incoming = toIncoming(
          (res.data as Record<string, unknown>).message
        );
        if (incoming) upsertMessage(incoming);
        return true;
      }
      message(String(res.detail || t("results.failed")), { type: "warning" });
      return false;
    } finally {
      nlRunning.value = false;
    }
  }

  /**
   * 执行已确认的动作草稿：以当前用户身份执行，服务端重校验 + 审计。
   * 412 + approval_required（需审批动作）返回 pending——审批通过后再次点击
   * 确认即原样重发，由 http 拦截器自动携带 X-Approval-Id。
   */
  async function executeAction(
    draft: AiActionDraft
  ): Promise<{ ok: boolean; pending?: boolean; detail?: string }> {
    const res = (await aiAssistantApi
      .actionExecute({ action: draft.action, params: draft.params })
      .catch((error: { code?: number; type?: string; detail?: string }) => ({
        code: Number(error?.code ?? -1),
        data: null,
        detail: String(error?.detail ?? error),
        type: error?.type
      }))) as ExecuteResponse;
    if (res.code === SUCCESS_CODE) {
      const incoming = toIncoming(
        (res.data as Record<string, unknown>)?.message
      );
      if (incoming) upsertMessage(incoming);
      return { ok: true, detail: String(res.detail || "") };
    }
    if (res.type === "approval_required" && res.code === 1002) {
      return { ok: false, pending: true, detail: res.detail };
    }
    return { ok: false, detail: res.detail };
  }

  // 切换入口：中断流 + 拉取该入口的持久化消息流
  watch(
    feature,
    () => {
      abortStream();
      loadHistory();
    },
    { immediate: true }
  );

  onUnmounted(() => {
    abortStream();
  });

  return {
    feature,
    messages,
    messageGroups,
    hasMore,
    loadingHistory,
    loadingMore,
    streaming,
    activeStreaming,
    pendingCount,
    scroller,
    nlRunning,
    loadHistory,
    loadMore,
    onScroll: () => onScroll(loadMore),
    scrollToBottom,
    send,
    abortStream,
    runNl,
    executeAction
  };
}

export type AiConsoleState = ReturnType<typeof useAiConsole>;
