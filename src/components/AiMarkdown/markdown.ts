import MarkdownIt from "markdown-it";
import type { HLJSApi } from "highlight.js";

import { sanitizeHtml } from "@/utils/sanitize";

/**
 * AI 回复 Markdown → 安全 HTML。
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
  return `<pre class="ai-md__pre"><code class="hljs${languageClass}">${highlighted}</code></pre>`;
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
