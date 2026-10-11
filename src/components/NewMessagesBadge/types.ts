/**
 * NewMessagesBadge 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 离底新消息悬浮条：计数大于 0 时出现，点击回到底部。
 */

export interface NewMessagesBadgeProps {
  /** 离底期间到达的新消息条数 */
  count: number;
}
