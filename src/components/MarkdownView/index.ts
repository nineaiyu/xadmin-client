import { withInstall } from "@pureadmin/utils";

import MarkdownView from "./index.vue";

/** 文档型 Markdown 渲染（markdown-it + DOMPurify + highlight.js 按需高亮） */
const MarkdownViewWithInstall = withInstall(MarkdownView);

export { MarkdownViewWithInstall };
export default MarkdownViewWithInstall;
