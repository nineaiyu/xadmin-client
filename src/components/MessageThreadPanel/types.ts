/**
 * MessageThreadPanel 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 消息流面板骨架：头部（窄屏折叠 + 标题 + 动作插槽）、消息列表壳与底部输入区插槽。
 */

export interface MessageThreadPanelProps {
  /** 头部标题与挂点（chat-room-title / ai-panel-title，E2E 以标题判定切换完成） */
  title: string;
  titleTestid: string;
  subtitle: string;
  /** 窄屏折叠按钮的可达名（会话列表 / 功能导航） */
  toggleLabel: string;
  isNarrow: boolean;
  /** 消息区滚动容器 testid（chat-messages / ai-messages） */
  listTestid: string;
  /** 历史骨架 testid（chat-history-skeleton / ai-history-skeleton） */
  skeletonTestid: string;
  /** 历史首屏加载且无行：骨架占位（与空态互斥，口径由调用方判定） */
  skeletonVisible: boolean;
  /** 显示「加载更早 / 没有更多」区（聊天室要求已选中会话） */
  historyBarVisible: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** 空态条件（各线口径不同，由调用方判定） */
  emptyVisible: boolean;
  emptyText: string;
  /** 离底期间的新消息计数（>0 显示悬浮条） */
  pendingCount: number;
}
