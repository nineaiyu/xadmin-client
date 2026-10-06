import type { Ref } from "vue";
import type { ChatAttachment, ChatMessageItem } from "@/api/chat";
import type {
  ChatReactionUpdatePayload,
  ChatRecallPayload
} from "@/utils/websocket/protocol";

/**
 * 消息集合的写入口径（乐观上屏 / 服务端对齐 / 撤回 / 表情回应 / 本地撤回窗口）——自 useChat 抽出（行数门禁）。
 *
 * 五处口径必须一致，集中在此才能保证「广播回来的正式载荷覆盖乐观气泡」只写一份：
 * - `upsert`：按 id 或 client_msg_id 命中即覆盖（服务端载荷赢），否则追加；
 *   返回是否为新增（决定滚动/未读计数）；
 * - `pushText / pushAttachment`：乐观上屏（id 取负数避免与服务端主键碰撞）；
 * - `applyRecall`：撤回为终态（清空内容与可撤回标记，保留气泡占位）；
 * - `applyReactions`：回应广播携带**全量**回应表，命中即整体替换（幂等，无需自行合并）；
 * - 本地撤回窗口：can_recall 仅 REST 历史下发，广播/回执不带——本人新消息由本地
 *   按与服务端同长的窗口置位，单一低频巡检过期复位（`dispose` 释放定时器）。
 */

/** 乐观上屏所需的上下文（房间与发送者快照，取值为调用时刻的实时值） */
export type MessageStoreContext = () => {
  roomId: number;
  roomType: string;
  sender: { pk: number; username: string; avatar: string };
};

/**
 * 撤回资格窗口（与服务端 message 应用模型层的 RECALL_WINDOW_MINUTES 同长：2 分钟）。
 * 服务端读侧口径：仅本人、未撤回、now - created_time 在窗口内。
 */
export const RECALL_WINDOW_MS = 2 * 60 * 1000;

/**
 * 窗口过期巡检间隔。取舍：不在每条消息上挂到期定时器（消息多时定时器数量随之
 * 增长，且逐个清理易漏），只用一个低频 interval 扫消息数组，过期最迟一个间隔
 * 后隐藏按钮；间隔内的少量超窗残留点击会收到服务端的窗口校验提示，无害。
 */
const RECALL_SWEEP_INTERVAL_MS = 15_000;

/** 是否仍在撤回窗口内（按消息创建时刻起算，与服务端读侧判定同口径） */
function withinRecallWindow(createdTime: string, now = Date.now()): boolean {
  const created = Date.parse(createdTime);
  return Number.isFinite(created) && now - created <= RECALL_WINDOW_MS;
}

export function createMessageStore(
  messages: Ref<ChatMessageItem[]>,
  context: MessageStoreContext
) {
  /** 本地撤回资格判定：仅本人、未撤回、服务端未明确给 false、窗口内 */
  function localRecallEligible(item: ChatMessageItem, now = Date.now()) {
    return (
      !item.is_recalled &&
      item.can_recall !== false &&
      item.sender_pk != null &&
      item.sender_pk === context().sender.pk &&
      withinRecallWindow(item.created_time, now)
    );
  }

  /** 广播/回执不带 can_recall：本人窗口内的新消息按本地窗口补位，服务端明确下发的口径不动 */
  function needsLocalRecallFlag(
    incoming: ChatMessageItem,
    candidate: ChatMessageItem
  ) {
    return incoming.can_recall === undefined && localRecallEligible(candidate);
  }

  function upsert(incoming: ChatMessageItem): boolean {
    const index = messages.value.findIndex(
      item =>
        item.id === incoming.id ||
        (!!incoming.client_msg_id &&
          item.client_msg_id === incoming.client_msg_id)
    );
    if (index >= 0) {
      const merged = {
        ...messages.value[index],
        ...incoming,
        sending: false,
        failed: false
      };
      // undefined 不覆盖旧值：本地置位在乐观气泡对齐正式载荷后继续有效
      if (needsLocalRecallFlag(incoming, merged)) {
        merged.can_recall = true;
      }
      messages.value[index] = merged;
      return false;
    }
    // 纯新消息（如其他端登录的同账号广播）同样按本地窗口补位
    messages.value.push(
      needsLocalRecallFlag(incoming, incoming)
        ? { ...incoming, can_recall: true }
        : incoming
    );
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

  /** 表情回应广播（chat_reaction）：reactions 为全量表，整体替换本地状态 */
  function applyReactions(payload: ChatReactionUpdatePayload) {
    const target = messages.value.find(item => item.id === payload.message);
    if (target) {
      target.extra = { ...target.extra, reactions: payload.reactions };
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
      sending: true,
      // 乐观上屏即本人新消息：先按本地窗口给出撤回资格（历史/广播下发口径除外），
      // 过期由巡检复位
      can_recall: true
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

  /**
   * 窗口过期巡检：把超窗消息的 can_recall 复位。以 created_time 起算与服务端
   * 同窗口，因此历史下发 true 的本人消息过期后同样收口（服务端那一刻也会判 false），
   * 避免点撤回必失败；他人消息与服务端明确 false 的不受影响。
   */
  function sweepRecallWindow(now = Date.now()) {
    for (const item of messages.value) {
      if (item.can_recall && !localRecallEligible(item, now)) {
        item.can_recall = false;
      }
    }
  }

  const sweepTimer = setInterval(sweepRecallWindow, RECALL_SWEEP_INTERVAL_MS);

  /** 释放窗口巡检定时器（hook 卸载时调用，避免常驻 interval） */
  function dispose() {
    clearInterval(sweepTimer);
  }

  return {
    upsert,
    applyRecall,
    applyReactions,
    pushText,
    pushAttachment,
    dispose
  };
}
