import { withInstall } from "@pureadmin/utils";

import AiMarkdown from "./index.vue";

/** AI 回复 Markdown 渲染（markdown-it + DOMPurify + highlight.js 按需高亮） */
const AiMarkdownWithInstall = withInstall(AiMarkdown);

export { AiMarkdownWithInstall };
export default AiMarkdownWithInstall;
export * from "./types";
