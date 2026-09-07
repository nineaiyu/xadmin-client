import DOMPurify from "dompurify";

/**
 * SEC-3：富文本 HTML 净化（前端兜底）。
 *
 * 公告/站内信等内容以 v-html 渲染，服务端入库前已做 bleach 白名单净化；
 * 本函数作为展示层兜底，剥离脚本、事件属性与危险协议，防止存储型 XSS。
 * 与服务端 white-list 语义保持一致：保留排版标签，剥离其余。
 */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "col",
  "colgroup",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "video",
  "source"
];

const ALLOWED_ATTR = [
  "class",
  "style",
  "href",
  "title",
  "target",
  "rel",
  "src",
  "alt",
  "width",
  "height",
  "colspan",
  "rowspan",
  "start",
  "controls",
  "poster",
  "type"
];

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  });
}
