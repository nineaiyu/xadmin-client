/**
 * AiStreamingBubble 对外类型（props 单一来源，组件与消费端共用）。
 *
 * 流式回答气泡：头像、可选名字行、思考/正文流式块与停止生成。
 */

export interface AiStreamingBubbleProps {
  /** 思考增量（reasoning_content 流式累积） */
  reasoning?: string;
  /** 正文增量 */
  content?: string;
  /** 气泡容器 testid（chat-streaming / ai-streaming） */
  testid: string;
  /** 停止按钮 testid（chat-stream-stop / ai-stream-stop） */
  stopTestid: string;
  /** 停止按钮文案 */
  stopLabel: string;
  /** 是否显示名字行（聊天室显示「AI 助手」，助手页省略） */
  showName?: boolean;
  /** 名字行文案 */
  nameLabel?: string;
}
