import { computed, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { isAbortError, SseError } from "@/utils/sse";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/ai/ai";
import { toIncoming } from "./useAiConsoleMessages";

type TFunction = ReturnType<typeof useI18n>["t"];

type StreamState = {
  feature: AiConsoleFeature;
  content: string;
  reasoning: string;
};

/**
 * AI 控制台流式发送域（自 useAiConsole 抽出）：同一时刻只允许一路流式生成；
 * 三个入口（文档问答 / 数据查询 / 指令执行）共用同一套帧分派，仅端点不同。
 * 中断句柄（streamAbort）为本模块私有，切入口/卸载时经 abortStream 复位。
 */
export function useAiConsoleStream({
  t,
  feature,
  atBottom,
  upsertMessage,
  pushOptimistic,
  removeOptimistic,
  scrollToBottom
}: {
  t: TFunction;
  feature: Ref<AiConsoleFeature>;
  atBottom: Ref<boolean>;
  upsertMessage: (incoming: AiConsoleMessage) => void;
  pushOptimistic: (content: string) => void;
  removeOptimistic: (content: string) => void;
  scrollToBottom: () => void;
}) {
  const streaming = ref<StreamState | null>(null);
  /** 流式气泡归属当前入口才渲染（切入口后残留的流不显示） */
  const activeStreaming = computed(() =>
    streaming.value && streaming.value.feature === feature.value
      ? streaming.value
      : null
  );
  let streamAbort: AbortController | null = null;

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

  return {
    streaming,
    activeStreaming,
    send,
    abortStream
  };
}
