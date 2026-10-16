import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import { message } from "@/utils/message";
import { isAbortError, SseError } from "@/utils/sse";
import { streamAiMessage, type ChatMessageItem } from "@/api/chat";

/** 流式输出状态：roomId 为归属会话，content / reasoning 为已到达增量 */
export type ChatStreaming = {
  roomId: number;
  content: string;
  reasoning: string;
} | null;

/**
 * AI 流式提问（SSE）与中断：单次流的生命周期与帧分派（自 useChat 抽出）。
 * 状态与动作依赖经 options 注入（与 useChatAttachments 同口径：状态由调用方持有）。
 */
export function useChatStreaming(options: {
  activeRoomId: Ref<number | null>;
  streaming: Ref<ChatStreaming>;
  genClientMsgId: () => string;
  pushText: (_content: string, _clientMsgId: string) => void;
  upsertMessage: (_item: ChatMessageItem) => void;
  scrollToBottom: () => void;
  atBottom: Ref<boolean>;
  markFailed: (_clientMsgId: string, _detail?: string) => void;
}) {
  const { t } = useI18n();
  let streamAbort: AbortController | null = null;

  /**
   * AI 流式提问（SSE）：思考增量与回答增量分别写入 streaming 气泡；
   * done/error 帧带回正式载荷（服务端落库 + WS 广播，多端经 upsertMessage 对齐）。
   */
  async function sendAi(content: string) {
    const text = content.trim();
    if (!text || !options.activeRoomId.value || options.streaming.value) return;
    const clientMsgId = options.genClientMsgId();
    const roomId = options.activeRoomId.value;
    options.pushText(text, clientMsgId);
    options.scrollToBottom();
    options.streaming.value = { roomId, content: "", reasoning: "" };
    streamAbort = new AbortController();
    try {
      await streamAiMessage(
        { room_id: roomId, content: text, client_msg_id: clientMsgId },
        {
          onMeta: data => {
            // 问题回执：以服务端正式载荷对齐乐观上屏（id/created_time）
            if (data?.question) options.upsertMessage(data.question);
          },
          onReasoning: delta => {
            if (!options.streaming.value) return;
            options.streaming.value.reasoning += delta;
            if (options.atBottom.value) options.scrollToBottom();
          },
          onDelta: delta => {
            if (!options.streaming.value) return;
            options.streaming.value.content += delta;
            if (options.atBottom.value) options.scrollToBottom();
          },
          onDone: data => {
            if (data?.message) options.upsertMessage(data.message);
          },
          onError: data => {
            if (data?.message) options.upsertMessage(data.message);
            if (data?.detail) message(String(data.detail), { type: "warning" });
          }
        },
        streamAbort.signal
      );
    } catch (error) {
      if (isAbortError(error)) return;
      const detail =
        error instanceof SseError ? error.message : t("chat.aiFailed");
      options.markFailed(clientMsgId, detail);
    } finally {
      options.streaming.value = null;
      streamAbort = null;
      options.scrollToBottom();
    }
  }

  /** 中断进行中的 AI 流（切会话/卸载时）：已到达的增量随 streaming 复位丢弃 */
  function abortStream() {
    streamAbort?.abort();
    streamAbort = null;
    options.streaming.value = null;
  }

  return { sendAi, abortStream };
}
