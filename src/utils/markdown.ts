import type { HLJSApi } from "highlight.js";
import MarkdownIt from "markdown-it";

import { sanitizeHtml } from "@/utils/sanitize";

/**
 * 共享 Markdown 渲染（AI 回复 / 公告正文等所有 Markdown 消费方）。
 *
 * - 解析：markdown-it（关闭原始 HTML，避免模型输出直通 `v-html`；支持表格、
 *   删除线、自动链接、围栏代码块）；
 * - 净化：统一走 `sanitizeHtml`（DOMPurify 白名单），即使解析器产出异常标签
 *   也不会进入 DOM；
 * - 高亮：highlight.js 的 common 语言包按需动态加载（仅当正文出现围栏代码块），
 *   未加载/语言未注册时退回转义后的纯代码，不阻塞 Markdown 渲染。
 */

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

// 外部链接新窗口打开，并补齐 rel（DOMPurify 白名单保留 target/rel）
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, index, options, env, self);
};

let hljs: HLJSApi | null = null;
let highlightLoading: Promise<boolean> | null = null;
/** 单次 render 期间是否启用高亮（流式期间关闭，避免长代码块逐增量重高亮） */
let highlightEnabled = true;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 按需加载 highlight.js common 语言包（失败不抛错，退化为纯代码块）。 */
export function ensureMarkdownHighlight(): Promise<boolean> {
  if (hljs) return Promise.resolve(true);
  if (!highlightLoading) {
    highlightLoading = import("highlight.js/lib/common")
      .then(module => {
        hljs = module.default;
        return true;
      })
      .catch(() => false);
  }
  return highlightLoading;
}

function renderCode(code: string, language: string): string {
  const lang = language.trim().toLowerCase();
  let highlighted = escapeHtml(code);
  if (highlightEnabled && hljs && lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, {
        language: lang,
        ignoreIllegals: true
      }).value;
    } catch {
      // 语言解析失败（畸形代码/未知方言）：保留转义后的纯代码
      highlighted = escapeHtml(code);
    }
  }
  const languageClass = lang ? ` language-${escapeHtml(lang)}` : "";
  return `<pre class="md-pre ai-md__pre"><code class="hljs${languageClass}">${highlighted}</code></pre>`;
}

md.set({
  highlight: renderCode
});

/**
 * Markdown 源文本 → 经 DOMPurify 白名单净化的 HTML。
 *
 * ``highlight=false`` 用于流式增量：只做解析与转义，不跑 highlight.js
 * （长代码块每个 token 重高亮会明显卡顿）；流结束后再以默认值重渲染一次。
 */
export function renderMarkdown(
  content: string,
  options: { highlight?: boolean } = {}
): string {
  if (!content) return "";
  highlightEnabled = options.highlight !== false;
  try {
    return sanitizeHtml(md.render(content));
  } finally {
    highlightEnabled = true;
  }
}

/**
 * Markdown → 纯文本预览（桌面通知 / ElNotification 正文）。
 *
 * 推送通道只接收纯文本：先把 Markdown 渲染为安全 HTML，再取 textContent，
 * 避免通知里出现 `**`、`#`、表格管道符与代码围栏标记。
 */
export function markdownToPlainText(content: string): string {
  if (!content) return "";
  const html = renderMarkdown(content, { highlight: false });
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const container = document.createElement("div");
  // 块级标签后补空格：textContent 本身不区分段落，避免多段/列表项粘连
  container.innerHTML = html.replace(
    /<\/(p|div|li|h[1-6]|tr|pre|blockquote|table)>/gi,
    "$& "
  );
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Markdown 链接/图片语法中的本地媒体地址（用于回填公告附件关联） */
const MARKDOWN_LINK_RE = /!?\[[^\]]*]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * 从 Markdown 源码提取媒体文件链接（`/media/...`）。
 *
 * Markdown 编辑器没有富文本编辑器的元素树，附件关联以正文为准：
 * 删除图片/附件语法即不再关联，避免 AutoCleanFileMixin 被无主文件占用。
 */
export function extractMarkdownMediaFiles(content: string): string[] {
  const files = new Set<string>();
  for (const match of String(content ?? "").matchAll(MARKDOWN_LINK_RE)) {
    const url = match[1];
    if (url && url.includes("/media/")) files.add(url);
  }
  return [...files];
}
