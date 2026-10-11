/**
 * AiActionCard 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 受限动作草稿的确认卡：参数明细 + 确认/取消 + 审批挂起与失败重试的回执状态。
 */
import type { AiActionDraft } from "@/api/ai/ai";

/** 受限动作执行结果回执（父级执行器返回；pending = 审批拦截待重发） */
export type AiActionExecuteResult = {
  ok: boolean;
  pending?: boolean;
  detail?: string;
};

export interface AiActionCardProps {
  draft: AiActionDraft;
  runnable: boolean;
  executor: (_draft: AiActionDraft) => Promise<AiActionExecuteResult>;
  /** 卡片 testid 前缀（助手页默认 ai；聊天室复用本组件传 chat，E2E 选择器不变） */
  testidPrefix?: string;
  /** 不可执行时的提示文案（如无「AI 指令执行」权限）；空则不提示（历史回看场景） */
  disabledHint?: string;
}
