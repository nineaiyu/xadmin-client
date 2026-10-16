import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import { message } from "@/utils/message";
import { MessageAction } from "@/utils/websocket/protocol";
import type { ChatMessageItem } from "@/api/chat";
import type { WS } from "@/utils/websocket";

/**
 * 聊天室发送域（自 useChat 抽出）：WS 上行收口、文本乐观上屏与失败重发。
 *
 * - 上行收口：仅判 socket 存在不够——连接未就绪/重连竞态下 send 可能抛错或报文
 *   无声丢失；断连或异常时把乐观行标记失败并复用断连提示，交给用户手动重发；
 * - 重发沿用原 client_msg_id（服务端幂等，不会重复落库）；附件消息沿用已上传
 *   的附件引用；AI 房间/消息走流式重发（惰性引用，见 deps.getSendAi）。
 */
export function useChatSend(deps: {
  activeRoomId: Ref<number>;
  socket: Ref<WS | undefined>;
  connected: Ref<boolean>;
  messages: Ref<ChatMessageItem[]>;
  pushText: (content: string, clientMsgId: string) => void;
  scrollToBottom: () => void;
  genClientMsgId: () => string;
  /** 惰性取 AI 流式发送：与流式域互有先后，取函数引用避免装配次序耦合 */
  getSendAi: () => (content: string) => void;
}) {
  const { t } = useI18n();

  function markFailed(clientMsgId: string, detail?: string) {
    const target = deps.messages.value.find(
      item => item.client_msg_id === clientMsgId
    );
    if (target) {
      target.sending = false;
      target.failed = true;
    }
    if (detail) message(detail, { type: "warning" });
  }

  function sendChatFrame(
    payload: Record<string, unknown>,
    clientMsgId?: string
  ): boolean {
    if (!deps.socket.value || !deps.connected.value) {
      if (clientMsgId) markFailed(clientMsgId);
      message(t("chat.disconnected"), { type: "warning" });
      return false;
    }
    try {
      deps.socket.value.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      if (clientMsgId) markFailed(clientMsgId);
      message(t("chat.disconnected"), { type: "warning" });
      console.warn("[chat] ws send failed:", error);
      return false;
    }
  }

  function send(content: string) {
    const text = content.trim();
    if (!text || !deps.activeRoomId.value) return;
    const clientMsgId = deps.genClientMsgId();
    deps.pushText(text, clientMsgId);
    deps.scrollToBottom();
    sendChatFrame(
      {
        action: MessageAction.CHAT_MESSAGE,
        data: {
          room_id: deps.activeRoomId.value,
          content: text,
          client_msg_id: clientMsgId
        }
      },
      clientMsgId
    );
  }

  function resend(item: ChatMessageItem) {
    if (!item.client_msg_id) return;
    item.failed = false;
    item.sending = true;
    if (item.message_type === "ai" || item.room_type === "ai") {
      item.sending = false;
      deps.getSendAi()(item.content);
      return;
    }
    const payload: Record<string, unknown> = {
      room_id: deps.activeRoomId.value,
      content: item.content,
      client_msg_id: item.client_msg_id
    };
    if (item.message_type === "image" || item.message_type === "file") {
      // 附件消息重发：沿用已上传的附件引用（服务端幂等，不会重复落库）
      const filePk = item.extra?.file?.pk;
      if (!filePk) {
        item.sending = false;
        item.failed = true;
        return;
      }
      payload.message_type = item.message_type;
      payload.file_pk = filePk;
    }
    // 上行失败由 sendChatFrame 收口：行重新标记 failed，保留重发入口
    sendChatFrame(
      { action: MessageAction.CHAT_MESSAGE, data: payload },
      item.client_msg_id
    );
  }

  return { markFailed, sendChatFrame, send, resend };
}
