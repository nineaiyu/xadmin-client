import { computed, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/ai/ai";
import {
  buildPartialMessage,
  buildStreamHandlers,
  notifyStreamError,
  type StreamHandlers,
  type StreamState
} from "./useAiConsoleFrames";

type TFunction = ReturnType<typeof useI18n>["t"];

function runEntry(
  kind: AiConsoleFeature,
  text: string,
  handlers: StreamHandlers,
  signal: AbortSignal
) {
  if (kind === "nl") {
    return aiAssistantApi.nlInterpretStream(text, handlers, signal);
  }
  if (kind === "action") {
    return aiAssistantApi.actionInterpretStream(text, handlers, signal);
  }
  return aiAssistantApi.askStream(text, handlers, signal);
}

const FAILED_KEY: Record<AiConsoleFeature, string> = {
  docs: "ai.askFailed",
  nl: "ai.nlFailed",
  action: "ai.actionFailed"
};

/**
 * AI 控制台流式发送域（自 useAiConsole 抽出）：同一时刻只允许一路流式生成；
 * 三个入口（文档问答 / 数据查询 / 指令执行）共用同一套帧分派（useAiConsoleFrames），
 * 仅端点与失败文案不同。中断句柄（streamAbort）为本模块私有，切入口/卸载时经
 * abortStream 复位。
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

  const handlers = buildStreamHandlers({
    streaming,
    atBottom,
    scrollToBottom,
    upsertMessage
  });

  /** 单次流式请求：乐观上屏 → 帧分派 → 失败归一 → 收尾复位 */
  async function runStream(kind: AiConsoleFeature, text: string) {
    pushOptimistic(text);
    scrollToBottom();
    streaming.value = { feature: kind, content: "", reasoning: "" };
    streamAbort = new AbortController();
    const signal = streamAbort.signal;
    try {
      await runEntry(kind, text, handlers, signal);
    } catch (error) {
      notifyStreamError(error, t(FAILED_KEY[kind]), text, removeOptimistic);
    } finally {
      streaming.value = null;
      streamAbort = null;
      scrollToBottom();
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || streaming.value) return;
    runStream(feature.value, content);
  }

  function abortStream() {
    const partial = streaming.value;
    if (partial && (partial.content || partial.reasoning)) {
      upsertMessage(buildPartialMessage(partial, t));
    }
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
