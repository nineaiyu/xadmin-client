import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { isAbortError, SseError } from "@/utils/sse";
import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 进行中的流式气泡状态（增量累计；归属入口在切换后不再渲染） */
export type StreamState = {
  feature: AiConsoleFeature;
  content: string;
  reasoning: string;
};

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
