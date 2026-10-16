/**
 * ChatTextBubble 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 文本气泡：自己靠右主色、他人浅色；支持撤回占位与弱化（只有思考无回答）态。
 */

export interface ChatTextBubbleProps {
  content: string;
  /** 自己的消息（主色气泡 + 白字） */
  mine?: boolean;
  /** 弱化展示（模型只产出思考时正文为提示文案） */
  muted?: boolean;
  /** 撤回占位文案（非空时展示占位而非正文） */
  recalledText?: string;
}
