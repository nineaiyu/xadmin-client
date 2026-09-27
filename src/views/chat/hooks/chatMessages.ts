import type { Ref } from "vue";
import type { ChatAttachment, ChatMessageItem } from "@/api/chat";
import type { ChatRecallPayload } from "@/utils/websocket/protocol";

/**
 * 消息集合的写入口径（乐观上屏 / 服务端对齐 / 撤回）——自 useChat 抽出（行数门禁）。
 *
 * 三处口径必须一致，集中在此才能保证「广播回来的正式载荷覆盖乐观气泡」只写一份：
 * - `upsert`：按 id 或 client_msg_id 命中即覆盖（服务端载荷赢），否则追加；
 *   返回是否为新增（决定滚动/未读计数）；
 * - `pushText / pushAttachment`：乐观上屏（id 取负数避免与服务端主键碰撞）；
 * - `applyRecall`：撤回为终态（清空内容与可撤回标记，保留气泡占位）。
 */

/** 乐观上屏所需的上下文（房间与发送者快照，取值为调用时刻的实时值） */
export type MessageStoreContext = () => {
  roomId: number;
  roomType: string;
  sender: { pk: number; username: string; avatar: string };
};

export function createMessageStore(
  messages: Ref<ChatMessageItem[]>,
  context: MessageStoreContext
) {
  function upsert(incoming: ChatMessageItem): boolean {
    const index = messages.value.findIndex(
      item =>
        item.id === incoming.id ||
        (!!incoming.client_msg_id &&
          item.client_msg_id === incoming.client_msg_id)
    );
    if (index >= 0) {
      messages.value[index] = {
        ...messages.value[index],
        ...incoming,
        sending: false,
        failed: false
      };
      return false;
    }
    messages.value.push(incoming);
    return true;
  }

  function applyRecall(payload: ChatRecallPayload) {
    const target = messages.value.find(item => item.id === payload.message_id);
    if (target) {
      target.is_recalled = true;
      target.content = "";
      target.can_recall = false;
    }
  }

  function baseFields(clientMsgId: string) {
    const { roomId, roomType, sender } = context();
    return {
      id: -Date.now(),
      room_id: roomId,
      room_type: roomType,
      sender_pk: sender.pk,
      sender_name: sender.username,
      sender_avatar: sender.avatar,
      created_time: new Date().toISOString(),
      client_msg_id: clientMsgId,
      sending: true
    };
  }

  function pushText(content: string, clientMsgId: string) {
    messages.value.push({
      ...baseFields(clientMsgId),
      message_type: "text",
      content,
      extra: {}
    });
  }

  /** 附件消息的乐观上屏：气泡立即显示文件名/进度，服务端广播回来后按 id 对齐覆盖 */
  function pushAttachment(attachment: ChatAttachment, clientMsgId: string) {
    messages.value.push({
      ...baseFields(clientMsgId),
      message_type: attachment.kind,
      content: attachment.filename,
      extra: { file: attachment }
    });
  }

  return { upsert, applyRecall, pushText, pushAttachment };
}
