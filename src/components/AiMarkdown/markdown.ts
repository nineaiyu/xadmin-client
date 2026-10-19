/**
 * AI 回复 Markdown 渲染入口（实现下沉到 `src/utils/markdown.ts`）。
 *
 * 解析 / 净化 / 高亮逻辑与公告 Markdown 展示共用同一份实现，避免两条渲染
 * 链路各自维护白名单与高亮策略。
 */
export { ensureMarkdownHighlight, renderMarkdown } from "@/utils/markdown";
