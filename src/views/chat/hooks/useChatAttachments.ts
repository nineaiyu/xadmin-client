import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  chatApi,
  type ChatAttachment,
  type ChatAttachmentKind
} from "@/api/chat";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { MessageAction } from "@/utils/websocket/protocol";
import type { WS } from "@/utils/websocket";

/**
 * 附件消息发送（图片 / 音视频 / 文件）——自 useChat 抽出（行数门禁）。
 *
 * 链路：上传端点取 file_pk（复用文件中心安全策略）→ 乐观上屏 → 与文本同一条
 * `chat_message` WS 上行帧（服务端校验归属与种类匹配后落库并广播）。
 * 上传失败给出可读提示；断线时乐观气泡标记失败（重发沿用同一 file_pk，服务端幂等）。
 */
export function useChatAttachments(deps: {
  /** 当前会话（0 表示未选会话） */
  activeRoomId: Ref<number>;
  socket: Ref<WS | undefined>;
  genClientMsgId: () => string;
  /** 乐观上屏（消息集合写入口径见 chatMessages.ts） */
  pushAttachment: (attachment: ChatAttachment, clientMsgId: string) => void;
  scrollToBottom: () => void;
  markFailed: (clientMsgId: string, detail?: string) => void;
  /**
   * WS 上行出口（useChat.sendChatFrame 注入）：连接未就绪/发送异常时内部
   * 已做断连提示 + 乐观行失败标记，此处不再自行判 socket（此前只判 socket
   * 存在，重连竞态下 send 可能抛错或报文无声丢失）
   */
  sendFrame: (
    payload: Record<string, unknown>,
    clientMsgId?: string
  ) => boolean;
}) {
  const { t } = useI18n();
  /** 附件上传中（>0 表示进行中，用于禁用重复触发） */
  const uploading = ref(0);

  async function sendAttachment(file: File, kind: ChatAttachmentKind) {
    if (!file || !deps.activeRoomId.value || uploading.value) return;
    const roomId = deps.activeRoomId.value;
    const clientMsgId = deps.genClientMsgId();
    uploading.value = 1;
    let attachment: ChatAttachment | null = null;
    try {
      const res = await chatApi.uploadAttachment(file, kind);
      if (res.code === SUCCESS_CODE && res.data) {
        attachment = res.data;
      } else {
        message(String(res.detail || t("chat.uploadFailed")), {
          type: "warning"
        });
      }
    } catch (error) {
      const detail = (error as { detail?: string })?.detail;
      message(String(detail || t("chat.uploadFailed")), { type: "warning" });
    } finally {
      uploading.value = 0;
    }
    if (!attachment) return;
    deps.pushAttachment(attachment, clientMsgId);
    deps.scrollToBottom();
    deps.sendFrame(
      {
        action: MessageAction.CHAT_MESSAGE,
        data: {
          room_id: roomId,
          message_type: attachment.kind,
          file_pk: attachment.pk,
          client_msg_id: clientMsgId
        }
      },
      clientMsgId
    );
  }

  return { uploading, sendAttachment };
}
