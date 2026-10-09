import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { isAbortError, SseError } from "@/utils/sse";
import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";
import { toIncoming } from "./useAiConsoleMessages";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 进行中的流式气泡状态（增量累计；归属入口在切换后不再渲染） */
export type StreamState = {
  feature: AiConsoleFeature;
  content: string;
  reasoning: string;
};

/** 流式帧回调集合（三入口共用；onDone/onError 载荷由各端点契约决定） */
export type StreamHandlers = {
  onMeta: (data: Record<string, unknown> | undefined) => void;
  onReasoning: (delta: string) => void;
  onDelta: (delta: string) => void;
  onDone: (data: { message?: unknown } | undefined) => void;
  onError: (data: { detail?: unknown; message?: unknown } | undefined) => void;
};

/**
 * 流式帧分派（自 useAiConsoleStream 抽出）：meta/done/error 载荷经 toIncoming
 * 对齐持久化消息上屏，增量帧累计进 streaming 状态，离底时不抢滚动。
 */
export function buildStreamHandlers({
  streaming,
  atBottom,
  scrollToBottom,
  upsertMessage
}: {
  streaming: Ref<StreamState | null>;
  atBottom: Ref<boolean>;
  scrollToBottom: () => void;
  upsertMessage: (incoming: AiConsoleMessage) => void;
}): StreamHandlers {
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

  return { onMeta, onReasoning, onDelta, onDone, onError };
}

/** 网络级失败兜底：头前错误（SseError）移除乐观占位，其余保留（服务端已落库） */
export function notifyStreamError(
  error: unknown,
  fallback: string,
  text: string,
  removeOptimistic: (content: string) => void
) {
  if (isAbortError(error)) return;
  if (error instanceof SseError) removeOptimistic(text);
  const detail = error instanceof SseError ? error.message : fallback;
  message(detail, { type: "warning" });
}

/**
 * 中断时把已累计增量固化为带「已中断」标记的本地助手消息：服务端对已到达
 * 增量按 partial 落库（刷新后从历史可见同一份内容），本地同步保留已上屏内容，
 * 避免复位 streaming 时把它凭空丢掉。
 */
export function buildPartialMessage(
  partial: StreamState,
  t: TFunction
): AiConsoleMessage {
  return {
    id: -Date.now(),
    feature: partial.feature,
    role: "assistant",
    content: partial.content,
    reasoning: partial.reasoning,
    extra: { partial: t("ai.streamInterrupted") },
    created_time: new Date().toISOString()
  };
}
