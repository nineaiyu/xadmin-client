/**
 * MessageActionAttachments 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 消息内嵌动作：多步草稿卡逐项渲染 + 只读执行结果表。
 */
import type { ActionDraftCarrier } from "@/utils/messageView";
import type { AiActionDraft } from "@/api/ai/ai";
import type { AiActionExecuteResult } from "@/components/AiActionCard/types";

export interface MessageActionAttachmentsProps {
  /** 消息 extra（动作草稿与执行结果的公共载体） */
  extra?: ActionDraftCarrier | null;
  /** 草稿卡可执行（false 时只读展示，可附 disabledHint） */
  runnable: boolean;
  executor: (_draft: AiActionDraft) => Promise<AiActionExecuteResult>;
  /** 卡片 testid 前缀（助手页缺省 ai；聊天室传 chat，E2E 选择器不变） */
  testidPrefix?: string;
  /** 不可执行时的提示文案；空则不提示 */
  disabledHint?: string;
}
