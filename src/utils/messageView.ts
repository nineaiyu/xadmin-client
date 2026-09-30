import type { AiActionDraft } from "@/api/ai/ai";

/** 动作草稿载体：聊天消息 extra / 助手消息 extra 在动作字段上的结构面 */
type ActionDraftCarrier = {
  action_drafts?: AiActionDraft[] | null;
  action_draft?: AiActionDraft | null;
};

/**
 * 消息时间标签（HH:mm，本地时区）；无效时间返回空串，调用方据此隐藏时间行。
 * 聊天室与助手页两条消息线共用（原两处逐字重复实现收敛于此）。
 */
export function formatMessageTime(value?: string): string {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

/**
 * 动作草稿列表：多步串联（action_drafts）优先，兼容单动作契约（action_draft）。
 * 聊天室消息与助手消息的 extra 同构，两处渲染共用同一取值口径。
 */
export function pickActionDrafts(
  extra?: ActionDraftCarrier | null
): AiActionDraft[] {
  const list = extra?.action_drafts;
  if (Array.isArray(list) && list.length) return list;
  const single = extra?.action_draft;
  return single ? [single] : [];
}
