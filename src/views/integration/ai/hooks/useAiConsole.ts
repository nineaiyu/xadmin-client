import { SUCCESS_CODE } from "@/api/types";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SseError } from "@/utils/sse";
import {
  aiAssistantApi,
  type AiActionDraft,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/system/ai";

/** 历史分页每页条数（与服务端默认/上限一致：20 / 100） */
const PAGE_SIZE = 20;
/** 气泡时间分组阈值：超过该间隔另起一个时间分隔（与聊天室同口径） */
const TIME_GROUP_GAP = 5 * 60 * 1000;

type StreamState = {
  feature: AiConsoleFeature;
  content: string;
  reasoning: string;
};

type ExecuteResponse = {
  code: number;
  data: unknown;
  detail?: string;
  type?: string;
};

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

/** 服务端消息载荷校验（history / meta / done / error 共用） */
function toIncoming(payload: unknown): AiConsoleMessage | null {
  const row = payload as AiConsoleMessage | undefined;
  return row && row.role && typeof row.content === "string" ? row : null;
}

/**
 * AI 助手控制台状态（左右分栏三入口：文档问答 / 数据查询 / 指令执行）。
 *
 * - 消息持久化在服务端（AiChatMessage）：进入/切换入口拉取最近一页，
 *   `before_id` 向上翻页；流式 done/error 携带服务端载荷，乐观上屏按载荷对齐，
 *   刷新后从历史端点得到同一份数据（本地不另造展示格式）；
 * - 三个入口各自独立的持久化消息流，同一时刻只允许一路流式生成。
 */
export function useAiConsole() {
  const { t } = useI18n();

  const feature = ref<AiConsoleFeature>("docs");
  const messages = ref<AiConsoleMessage[]>([]);
  const hasMore = ref(false);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);
  const streaming = ref<StreamState | null>(null);
  /** 离底时的新消息计数（悬浮条「N 条新消息」） */
  const pendingCount = ref(0);
  const scroller = ref<HTMLElement | null>(null);
  const atBottom = ref(true);
  /** NL 查询运行中（运行按钮 loading） */
  const nlRunning = ref(false);
  let streamAbort: AbortController | null = null;

  /** 流式气泡归属当前入口才渲染（切入口后残留的流不显示） */
  const activeStreaming = computed(() =>
    streaming.value && streaming.value.feature === feature.value
      ? streaming.value
      : null
  );

  // ------------------------------------------------------------------ 时间分组

  const messageGroups = computed(() => {
    const rows: Array<
      | { type: "divider"; key: string; label: string }
      | { type: "message"; key: string; item: AiConsoleMessage }
    > = [];
    let lastTime = 0;
    for (const item of messages.value) {
      const time = new Date(item.created_time).getTime();
      if (!lastTime || time - lastTime > TIME_GROUP_GAP) {
        rows.push({
          type: "divider",
          key: `d-${item.id}`,
          label: formatDivider(time)
        });
      }
      rows.push({ type: "message", key: `m-${item.id}`, item });
      lastTime = time;
    }
    return rows;
  });

  function formatDivider(time: number) {
    if (!time) return "";
    const date = new Date(time);
    const now = new Date();
    const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    if (date.toDateString() === now.toDateString()) return hm;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (date.toDateString() === yesterday.toDateString())
      return `${t("chat.yesterday")} ${hm}`;
    return `${date.getMonth() + 1}-${date.getDate()} ${hm}`;
  }

  // ------------------------------------------------------------------ 消息对齐

  function upsertMessage(incoming: AiConsoleMessage) {
    const index = messages.value.findIndex(
      item =>
        item.id === incoming.id ||
        // 乐观占位（负 id）按「同角色 + 同内容」对齐为服务端载荷
        (item.id < 0 &&
          item.role === incoming.role &&
          item.content === incoming.content)
    );
    if (index >= 0) {
      messages.value[index] = { ...messages.value[index], ...incoming };
      return;
    }
    messages.value.push(incoming);
    if (atBottom.value) scrollToBottom();
    else pendingCount.value += 1;
  }

  function pushOptimistic(content: string) {
    messages.value.push({
      id: -Date.now(),
      feature: feature.value,
      role: "user",
      content,
      reasoning: "",
      extra: {},
      created_time: new Date().toISOString()
    });
  }

  /** 响应头前失败（服务端未落库）：移除乐观占位 */
  function removeOptimistic(content: string) {
    const index = messages.value.findIndex(
      item => item.id < 0 && item.role === "user" && item.content === content
    );
    if (index >= 0) messages.value.splice(index, 1);
  }

  // ------------------------------------------------------------------ 历史

  async function loadHistory() {
    loadingHistory.value = true;
    messages.value = [];
    pendingCount.value = 0;
    try {
      const { code, data } = await aiAssistantApi.history({
        feature: feature.value,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = ((data?.results ?? []) as AiConsoleMessage[]) || [];
        hasMore.value = Boolean(data?.has_more);
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
      const { code, data } = await aiAssistantApi.history({
        feature: feature.value,
        before_id: firstId,
        limit: PAGE_SIZE
      });
      if (code === SUCCESS_CODE) {
        messages.value = [
          ...(((data?.results ?? []) as AiConsoleMessage[]) || []),
          ...messages.value
        ];
        hasMore.value = Boolean(data?.has_more);
        await nextTick();
        // 保持视觉位置：新增内容的高度差补回 scrollTop（与聊天室同口径）
        if (container) {
          container.scrollTop =
            previousTop + (container.scrollHeight - previousHeight);
        }
      }
    } finally {
      loadingMore.value = false;
    }
  }

  // ------------------------------------------------------------------ 滚动

  function scrollToBottom() {
    pendingCount.value = 0;
    nextTick(() => {
      if (scroller.value)
        scroller.value.scrollTop = scroller.value.scrollHeight;
    });
  }

  function onScroll() {
    const container = scroller.value;
    if (!container) return;
    atBottom.value =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      60;
    if (atBottom.value) pendingCount.value = 0;
    if (container.scrollTop < 40) loadMore();
  }

  // ------------------------------------------------------------------ 流式发送

  function startStream(current: AiConsoleFeature, text: string) {
    pushOptimistic(text);
    scrollToBottom();
    streaming.value = { feature: current, content: "", reasoning: "" };
    streamAbort = new AbortController();
    return streamAbort.signal;
  }

  function endStream() {
    streaming.value = null;
    streamAbort = null;
    scrollToBottom();
  }

  function onMeta(data: Record<string, unknown> | undefined) {
    const incoming = toIncoming(data?.user_message);
    if (incoming) upsertMessage(incoming);
  }

  function onReasoning(delta: string) {
    if (!streaming.value) return;
    streaming.value.reasoning += delta;
    if (atBottom.value) scrollToBottom();
  }

  function onDelta(delta: string) {
    if (!streaming.value) return;
    streaming.value.content += delta;
    if (atBottom.value) scrollToBottom();
  }

  function onDone(data: { message?: unknown } | undefined) {
    const incoming = toIncoming(data?.message);
    if (incoming) upsertMessage(incoming);
  }

  function onError(data: { detail?: unknown; message?: unknown } | undefined) {
    const incoming = toIncoming(data?.message);
    if (incoming) upsertMessage(incoming);
    if (data?.detail) message(String(data.detail), { type: "warning" });
  }

  /** 网络级失败兜底：头前错误（SseError）移除乐观占位，其余保留（服务端已落库） */
  function onStreamError(error: unknown, fallback: string, text: string) {
    if (isAbortError(error)) return;
    if (error instanceof SseError) removeOptimistic(text);
    const detail = error instanceof SseError ? error.message : fallback;
    message(detail, { type: "warning" });
  }

  async function askDocs(text: string) {
    const signal = startStream("docs", text);
    try {
      await aiAssistantApi.askStream(
        text,
        {
          onMeta,
          onReasoning,
          onDelta,
          onDone,
          onError
        },
        signal
      );
    } catch (error) {
      onStreamError(error, t("ai.askFailed"), text);
    } finally {
      endStream();
    }
  }

  async function askNl(text: string) {
    const signal = startStream("nl", text);
    try {
      await aiAssistantApi.nlInterpretStream(
        text,
        { onMeta, onReasoning, onDelta, onDone, onError },
        signal
      );
    } catch (error) {
      onStreamError(error, t("ai.nlFailed"), text);
    } finally {
      endStream();
    }
  }

  async function askAction(text: string) {
    const signal = startStream("action", text);
    try {
      await aiAssistantApi.actionInterpretStream(
        text,
        { onMeta, onReasoning, onDelta, onDone, onError },
        signal
      );
    } catch (error) {
      onStreamError(error, t("ai.actionFailed"), text);
    } finally {
      endStream();
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || streaming.value) return;
    if (feature.value === "docs") askDocs(content);
    else if (feature.value === "nl") askNl(content);
    else askAction(content);
  }

  /** 中断进行中的流（切入口/卸载时）：已到达增量随 streaming 复位丢弃 */
  function abortStream() {
    streamAbort?.abort();
    streamAbort = null;
    streaming.value = null;
  }

  // ------------------------------------------------------------------ 执行类操作

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
    onScroll,
    scrollToBottom,
    send,
    abortStream,
    runNl,
    executeAction
  };
}

export type AiConsoleState = ReturnType<typeof useAiConsole>;
