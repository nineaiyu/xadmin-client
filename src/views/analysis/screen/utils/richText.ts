/**
 * 富文本「受限标记」渲染（纯函数，单测见 `__tests__/richText.spec.ts`）。
 *
 * 为什么不做 HTML 直通：`v-html` 一旦吃外部字符串就有 XSS 面。这里把流程钉成
 * **先转义、再套白名单**——输入永远先当纯文本转义，只有本模块认识的标记会被
 * 替换成标签，因此输出面收敛为 `<strong> / <em> / <u> / <s> / <span style> / <br>`，
 * 且 `style` 的值只可能是校验过的十六进制颜色。
 *
 * 标记子集（与属性面板提示同文案）：
 * - `**粗体**`、`*斜体*`、`__下划线__`、`~~删除线~~`
 * - `[c=#rrggbb]彩字[/c]`（颜色仅收 3 / 6 位十六进制，非法写法按普通文本原样保留）
 * - 换行 → `<br>`（文本窗格保留排版）
 */

/** 允许的行内颜色：3 或 6 位十六进制（杜绝 `url(...)` / 引号 / 分号等注入面） */
export const RICH_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** HTML 转义：本模块所有输出的唯一入口，先转义再套标记 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 受限标记 → 白名单 HTML 字符串（可直接交给 `v-html`）。
 *
 * 顺序固定：转义 → 颜色 → 下划线 / 删除线 → 粗体 → 斜体 → 换行。
 * 粗体先于斜体（避免 `**x**` 被斜体规则先吃掉一对星号）；所有内层匹配都
 * 排除标记字符本身，因此不会跨标签吞并（也不可能吃掉刚生成的标签）。
 */
export function renderRichText(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /\[c=(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/c\]/g,
    (match, color: string, inner: string) =>
      RICH_COLOR_PATTERN.test(color)
        ? `<span style="color:${color}">${inner}</span>`
        : match
  );
  html = html.replace(/__([^_]+)__/g, "<u>$1</u>");
  html = html.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html.replace(/\n/g, "<br>");
}
