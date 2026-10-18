/**
 * AiMarkdown 对外类型（props 单一来源，组件与消费端共用）。
 *
 * AI 回复正文的 Markdown 渲染：流式内容随增量重渲染，流式态在末尾追加光标。
 */

export interface AiMarkdownProps {
  /** Markdown 源文本（流式追加 / 落库全文） */
  content?: string;
  /** 是否正在流式输出（末尾显示光标） */
  streaming?: boolean;
}
