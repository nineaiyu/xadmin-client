/**
 * MessageTimeDivider 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 消息流时间分隔行：标签由调用方按公共时间分组口径生成后传入。
 */

export interface MessageTimeDividerProps {
  /** 分隔标签（今日时分 / 昨天前缀 / 更早月-日 时分） */
  label: string;
}
