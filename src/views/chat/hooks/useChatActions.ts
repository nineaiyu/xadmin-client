import { genClientMsgId } from "./chatIds";
import { useChatSend } from "./useChatSend";
import { useChatReactions } from "./useChatReactions";
import { useChatStreaming } from "./useChatStreaming";
import { useChatAttachments } from "./useChatAttachments";
import type { useChatCore } from "./useChatCore";

/**
 * 聊天室动作域装配（自 useChat 抽出，行数门禁）：发送（WS 上行收口 / 重发）、
 * AI 流式（SSE）与中断、附件发送、撤回与表情回应。状态经 useChatCore 注入，
 * 本模块只做接线。
 */
export function useChatActions(core: ReturnType<typeof useChatCore>) {
  const sending = useChatSend({
    activeRoomId: core.activeRoomId,
    socket: core.socket,
    connected: core.connected,
    messages: core.messages,
    pushText: core.pushText,
    scrollToBottom: core.scrollToBottom,
    genClientMsgId,
    // 与流式域互有装配先后，惰性取值避免次序耦合
    getSendAi: () => streaming.sendAi
  });

  /** AI 流式（SSE）发送与中断（实现见 useChatStreaming.ts） */
  const streaming = useChatStreaming({
    activeRoomId: core.activeRoomId,
    streaming: core.streaming,
    genClientMsgId,
    pushText: core.pushText,
    upsertMessage: core.upsertMessage,
    scrollToBottom: core.scrollToBottom,
    atBottom: core.atBottom,
    markFailed: sending.markFailed
  });

  /** 附件发送（上传 + 乐观上屏 + WS 上行，实现见 useChatAttachments.ts） */
  const attachments = useChatAttachments({
    activeRoomId: core.activeRoomId,
    socket: core.socket,
    genClientMsgId,
    pushAttachment: core.pushAttachment,
    scrollToBottom: core.scrollToBottom,
    markFailed: sending.markFailed,
    sendFrame: sending.sendChatFrame
  });

  const { recall, toggleReaction } = useChatReactions({
    me: core.me,
    applyRecall: core.applyRecall,
    sendFrame: sending.sendChatFrame
  });

  return {
    send: sending.send,
    resend: sending.resend,
    sendAi: streaming.sendAi,
    abortStream: streaming.abortStream,
    uploading: attachments.uploading,
    sendAttachment: attachments.sendAttachment,
    recall,
    toggleReaction
  };
}
