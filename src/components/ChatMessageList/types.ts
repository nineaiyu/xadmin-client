/**
 * ChatMessageList 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 消息列表壳：滚动容器、历史骨架、加载更早条与空态，消息行经默认插槽渲染。
 */

export interface ChatMessageListProps {
  /** 滚动容器 testid（chat-messages / ai-messages） */
  testid: string;
  /** 骨架 testid（chat-history-skeleton / ai-history-skeleton） */
  skeletonTestid: string;
  /** 历史首屏加载且无行：骨架占位（与空态互斥） */
  skeletonVisible: boolean;
  /** 显示「加载更早 / 没有更多」区（聊天室要求已选中会话） */
  historyBarVisible: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** 空态条件（各线口径不同，由调用方判定） */
  emptyVisible: boolean;
  /** 空态文案 */
  emptyText: string;
}
