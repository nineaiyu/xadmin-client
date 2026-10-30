import { computed, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isAbortError } from "@/utils/sse";
import type { AiConsoleFeature, AiConsoleMessage } from "@/api/ai/ai";
import {
  buildSettledHandlers,
  FAILED_KEY,
  runConsoleEntry
} from "./aiConsoleStreamHandlers";
import {
  buildPartialMessage,
  notifyStreamError,
  type StreamState
} from "./useAiConsoleFrames";

type TFunction = ReturnType<typeof useI18n>["t"];

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
  /** 本次流是否收到终止帧（done/error）；EOF 未终结 = 服务端异常断流 */
  let settled = false;
  /** 失败草稿：seq 用于重复失败时也能触发回填（内容相同不丢通知） */
  const failedDraft = ref<{ seq: number; text: string } | null>(null);
  let draftSeq = 0;

  const handlers = buildSettledHandlers(
    { streaming, atBottom, scrollToBottom, upsertMessage },
    () => {
      settled = true;
    }
  );

  /** 单次流式请求：乐观上屏 → 帧分派 → 失败归一 → 收尾复位 */
  async function runStream(kind: AiConsoleFeature, text: string) {
    pushOptimistic(text);
    scrollToBottom();
    streaming.value = { feature: kind, content: "", reasoning: "" };
    settled = false;
    streamAbort = new AbortController();
    const signal = streamAbort.signal;
    try {
      await runConsoleEntry(kind, text, handlers, signal);
      if (!settled && !signal.aborted) {
        // 响应正常结束却没有 done/error：服务端流内异常未转 error 帧（历史 KeyError
        // 场景即如此），必须给出可见失败提示，避免界面静默停在「思考中」
        failedDraft.value = { seq: ++draftSeq, text };
        notifyStreamError(
          new Error("AI stream ended unexpectedly"),
          t(FAILED_KEY[kind]),
          text,
          removeOptimistic
        );
      }
    } catch (error) {
      if (!isAbortError(error)) {
        failedDraft.value = { seq: ++draftSeq, text };
      }
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
    failedDraft,
    send,
    abortStream
  };
}
