/**
 * ChatSystemNotice 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 系统提示窄条：流内失败降级、动作执行回执等居中提示。
 */

export interface ChatSystemNoticeProps {
  /** 提示文案 */
  content: string;
  /** 错误态配色（警告色） */
  error?: boolean;
}
