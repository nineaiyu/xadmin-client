import type { Ref } from "vue";
import { message } from "@/utils/message";

/** 增量累计的最小状态形状（聊天室 / AI 控制台各自的流式状态均满足） */
export interface StreamAccumulator {
  content: string;
  reasoning: string;
}

/** 流式帧回调集合（载荷类型由各端点契约标注；回调入参按 unknown 收口） */
export type StreamHandlers = {
  onMeta: (data?: unknown) => void;
  onReasoning: (delta: string) => void;
  onDelta: (delta: string) => void;
  onDone: (data?: unknown) => void;
  onError: (data?: unknown) => void;
};

/** 帧载荷 → 待 upsert 的消息（各消息线自己的判定与归一规则） */
export type IncomingResolver<TIncoming> = (
  data: unknown
) => TIncoming | null | undefined;

/**
 * 流式帧分派（聊天室 / AI 控制台共用）：meta/done/error 载荷经 resolver 归一后
 * upsert，错误详情提示；增量帧累计进 streaming 状态，离底时不抢滚动。
 */
export function buildStreamHandlers<
  TState extends StreamAccumulator,
  TIncoming
>(options: {
  streaming: Ref<TState | null>;
  atBottom: Ref<boolean>;
  scrollToBottom: () => void;
  upsertMessage: (incoming: TIncoming) => void;
  metaIncoming?: IncomingResolver<TIncoming>;
  doneIncoming?: IncomingResolver<TIncoming>;
  errorIncoming?: IncomingResolver<TIncoming>;
}): StreamHandlers {
  const { streaming, atBottom, scrollToBottom, upsertMessage } = options;

  function upsert(
    resolver: IncomingResolver<TIncoming> | undefined,
    data: unknown
  ) {
    const incoming = resolver?.(data);
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

  function onError(data: unknown) {
    upsert(options.errorIncoming, data);
    const detail = (data as { detail?: unknown } | undefined)?.detail;
    if (detail) message(String(detail), { type: "warning" });
  }

  return {
    onMeta: data => upsert(options.metaIncoming, data),
    onReasoning,
    onDelta,
    onDone: data => upsert(options.doneIncoming, data),
    onError
  };
}
