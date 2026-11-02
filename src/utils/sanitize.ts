import DOMPurify from "dompurify";

/**
 * 富文本 HTML 净化（前端兜底）。
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

/**
 * `style` 内允许的 CSS 属性（与服务端 bleach 的 CSSSanitizer 白名单同源）。
 *
 * 富文本正文需要对齐/色号等排版样式，整段 style 不能一刀切掉；
 * 但 `background-image: url(...)`、`position: fixed` 这类可外联或劫持层级的属性
 * 会形成像素追踪 / 覆盖界面的面（非 XSS），按安全默认只保留排版属性。
 */
const SAFE_CSS_PROPERTIES = new Set([
  "background-color",
  "border",
  "border-collapse",
  "border-color",
  "border-radius",
  "border-style",
  "border-width",
  "clear",
  "color",
  "display",
  "float",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "overflow",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "table-layout",
  "text-align",
  "text-decoration",
  "text-indent",
  "vertical-align",
  "white-space",
  "width",
  "height"
]);

/** 值侧兜底：即便属性在名单内，也拒绝 url()/expression() 等可执行或外联写法 */
const UNSAFE_CSS_VALUE =
  /url\s*\(|expression\s*\(|image-set|@import|javascript:/i;

/** 过滤 style 声明，只保留白名单属性与安全值 */
function filterCssDeclarations(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (!SAFE_CSS_PROPERTIES.has(name) || !value) continue;
    if (UNSAFE_CSS_VALUE.test(value)) continue;
    kept.push(`${name}: ${value}`);
  }
  return kept.join("; ");
}

// 展示层兜底：style 只保留排版属性（服务端已净化，这里防历史存量/外部来源）
DOMPurify.addHook("afterSanitizeAttributes", node => {
  const style = node.getAttribute?.("style");
  if (!style) return;
  const safe = filterCssDeclarations(style);
  if (safe) {
    node.setAttribute("style", safe);
  } else {
    node.removeAttribute("style");
  }
});

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
  });
}

/**
 * 内联 SVG 图标净化（菜单 icon 字段可来自后台配置）。
 *
 * 只放开 SVG 图形标签；DOMPurify 默认剥离 on* 事件属性与 javascript: 协议，
 * 这里再禁止 script/foreignObject 与 style（避免 CSS url() 夹带外链）。
 */
export function sanitizeSvgIcon(svg: string | null | undefined): string {
  if (!svg) return "";
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["style"]
  });
}
