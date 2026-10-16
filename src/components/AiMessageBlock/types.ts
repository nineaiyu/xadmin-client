/**
 * AiMessageBlock 对外类型（props 单一来源，组件与消费端共用）。
 *
 * AI 回复的统一布局：思考面板、正文（含流式/空态）与引用出处。
 */

export interface AiMessageBlockProps {
  /** 思考过程（reasoning_content，流式追加 / 落库全文） */
  reasoning?: string;
  /** 回复正文（流式追加 / 落库全文） */
  content?: string;
  /** 是否正在流式输出 */
  streaming?: boolean;
  /** 引用出处（知识库问答） */
  sources?: Array<{ title: string; path: string; chunk_index: number }>;
}
