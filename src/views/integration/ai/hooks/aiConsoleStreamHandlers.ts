import type { Ref } from "vue";

import {
  aiAssistantApi,
  type AiConsoleFeature,
  type AiConsoleMessage
} from "@/api/ai/ai";
import {
  buildStreamHandlers,
  type StreamHandlers
} from "@/hooks/useStreamFrames";
import type { StreamState } from "./useAiConsoleFrames";
import { toIncoming } from "./useAiConsoleMessages";

/** 三入口端点分派（文档问答 / 数据查询 / 指令执行） */
export function runConsoleEntry(
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

/** 三入口失败兜底文案（i18n key） */
export const FAILED_KEY: Record<AiConsoleFeature, string> = {
  docs: "ai.askFailed",
  nl: "ai.nlFailed",
  action: "ai.actionFailed"
};

/**
 * 包装终止帧回调：记录本次流是否收到 done/error。
 *
 * 服务端流内异常若未转 error 帧（历史 KeyError 场景），EOF 会被 `postSse`
 * 当成正常结束；调用方据此在收尾时补一条可见失败提示。
 */
export function buildSettledHandlers(
  options: {
    streaming: Ref<StreamState | null>;
    atBottom: Ref<boolean>;
    scrollToBottom: () => void;
    upsertMessage: (incoming: AiConsoleMessage) => void;
  },
  onSettled: () => void
): StreamHandlers {
  const base = buildStreamHandlers<StreamState, AiConsoleMessage>({
    ...options,
    metaIncoming: data =>
      toIncoming(
        (data as { user_message?: unknown } | undefined)?.user_message
      ),
    doneIncoming: data =>
      toIncoming((data as { message?: unknown } | undefined)?.message),
    errorIncoming: data =>
      toIncoming((data as { message?: unknown } | undefined)?.message)
  });
  return {
    ...base,
    onDone: data => {
      onSettled();
      base.onDone(data);
    },
    onError: data => {
      onSettled();
      base.onError(data);
    }
  };
}
