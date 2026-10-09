import { SUCCESS_CODE } from "@/api/types";
import type { Ref } from "vue";
import { message } from "@/utils/message";
import {
  MessageAction,
  type ChatRecallPayload
} from "@/utils/websocket/protocol";
import { chatApi, type ChatMessageItem } from "@/api/chat";

/**
 * 聊天室消息动作域（自 useChat 抽出）：撤回与表情回应。
 *
 * - 撤回：服务端确认后本地冻结消息（清内容、清可撤回标记）；
 * - 表情回应（chat_reaction 上行）：本地已在回应中则移除，否则添加；全量回应表
 *   由广播帧整体替换（限流与发送共用 5 条/秒）；上行经 sendFrame 收口
 *   （断连判定 + 异常吞掉提示，此前裸 send 在重连竞态下可能抛错或无声丢失）。
 */
export function useChatReactions(deps: {
  me: Ref<{ pk: number; username: string; avatar: string }>;
  applyRecall: (payload: ChatRecallPayload) => void;
  sendFrame: (
    payload: Record<string, unknown>,
    clientMsgId?: string
  ) => boolean;
}) {
  async function recall(item: ChatMessageItem) {
    const { code, detail } = await chatApi.recall(item.id);
    if (code === SUCCESS_CODE) {
      deps.applyRecall({ message_id: item.id, room_id: item.room_id });
    } else {
      message(detail, { type: "warning" });
    }
  }

  function toggleReaction(item: ChatMessageItem, emoji: string) {
    const op = item.extra?.reactions?.[emoji]?.includes(deps.me.value.pk)
      ? "remove"
      : "add";
    deps.sendFrame({
      action: MessageAction.CHAT_REACTION,
      data: { message: item.id, emoji, op }
    });
  }

  return { recall, toggleReaction };
}
