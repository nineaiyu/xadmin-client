/**
 * 富文本「受限标记」渲染（纯函数，单测见 `__tests__/richText.spec.ts`）。
 *
 * 为什么不做 HTML 直通 / 不引 Markdown 库：`v-html` 一旦吃外部字符串就有 XSS 面；
 * 第三方库则带来 bundle 与可控性问题。这里把流程钉成**先转义、再套白名单**——
 * 输入永远先当纯文本转义，只有本模块认识的标记会被替换成标签，因此输出面收敛为
 * `<strong> / <em> / <u> / <s> / <span style> / <a> / <img> / <ul> / <ol> / <li> /
 * <table> / <thead> / <tbody> / <tr> / <th> / <td> / <br>`，且属性只可能是校验过的
 * 十六进制颜色与 http(s) 地址。
 *
 * 标记子集（ADR-090 D1，与属性面板工具条同源）：
 * - 行内：`**粗体**`、`*斜体*`、`__下划线__`、`~~删除线~~`、`[c=#rrggbb]彩字[/c]`、
 *   `[文本](http(s)://…)`、裸 `http(s)://…` 自动成链、`![替代文本](http(s)://…)`；
 * - 块级：`- ` / `* ` 开头的连续行 = 无序列表，`1. ` 开头的连续行 = 有序列表，
 *   `| 单元格 | … |` + `|---|---|` 分隔行 = 表格（GFM 风格，单元格只允许行内标记）。
 */

/** 允许的行内颜色：3 或 6 位十六进制（杜绝 `url(...)` / 引号 / 分号等注入面） */
export const RICH_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 允许的外链协议：只收 http(s)（杜绝 `javascript:` / `data:` 等注入面） */
export function isSafeRichUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

/** HTML 转义：本模块所有输出的唯一入口，先转义再套标记 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 表格分隔行：`|---|---|`（允许 `:` 对齐标记与两侧空白） */
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const UNORDERED_ITEM = /^\s*[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;

/**
 * 行内标记 → 白名单 HTML。**刻意不导出**：入参必须是已转义文本（由 `renderRichText`
 * 统一保证），对外暴露会形成「绕过转义直接拼 HTML」的误用面（属性里的引号会逃逸）。
 *
 * 顺序固定：图片 → 链接 → 颜色 → 下划线 / 删除线 → 粗体 → 斜体 → 裸 URL。
 * 图片与链接先用占位符「寄存」，因此后续规则（含裸 URL 自动成链）不会二次改写
 * 已生成的 `<a href>` / `<img src>`；粗体先于斜体（避免 `**x**` 被斜体先吃掉一对星号）。
 */
function renderRichInline(escaped: string): string {
  const tokens: string[] = [];
  const stash = (html: string) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };

  let out = escaped;
  out = out.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi,
    (match, alt: string, url: string) =>
      isSafeRichUrl(url)
        ? stash(`<img src="${url}" alt="${alt}" loading="lazy" />`)
        : match
  );
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (match, label: string, url: string) =>
      isSafeRichUrl(url)
        ? stash(
            `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
          )
        : match
  );
  out = out.replace(
    /\[c=(#[0-9a-fA-F]{3,6})\]([\s\S]*?)\[\/c\]/g,
    (match, color: string, inner: string) =>
      RICH_COLOR_PATTERN.test(color)
        ? `<span style="color:${color}">${inner}</span>`
        : match
  );
  out = out.replace(/__([^_]+)__/g, "<u>$1</u>");
  out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // 裸 URL 自动成链（占位符里没有 http，因此不会重复包裹）
  out = out.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/gi,
    (_m, head: string, url: string) =>
      `${head}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
  return out.replace(
    /\u0000(\d+)\u0000/g,
    (_m, index: string) => tokens[Number(index)]
  );
}

/** 单元格 / 列表项：去空白后走行内渲染 */
const cell = (value: string) => renderRichInline(value.trim());

/** 表格块（首行表头 + 分隔行 + 数据行） */
function renderTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const [header, ...body] = rows;
  const head = header.map(item => `<th>${cell(item)}</th>`).join("");
  const bodyRows = body
    .map(
      row => `<tr>${row.map(item => `<td>${cell(item)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

/** 分割表格行 → 单元格（去掉首尾 `|`；行内 `|` 用 `\\|` 转义，这里不做嵌套语义） */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  return trimmed.slice(1, -1).split("|");
}

/**
 * 受限标记 → 白名单 HTML 字符串（可直接交给 `v-html`）。
 *
 * 块级按行扫描：表格（表头 + 分隔行开头）> 列表（连续同类行）> 段落（连续普通行，
 * 行内换行仍转 `<br>` 保留排版）；块级之间不再插空行。
 */
export function renderRichText(text: string): string {
  const lines = escapeHtml(text).split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map(renderRichInline).join("<br>")}</p>`);
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // 表格：当前行是 | … |，下一行是分隔行
    if (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[index + 1] ?? "")) {
      flushParagraph();
      const rows: string[][] = [splitRow(line)];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push(renderTable(rows));
      continue;
    }
    const unordered = UNORDERED_ITEM.exec(line);
    if (unordered) {
      flushParagraph();
      const items: string[] = [unordered[1]];
      while (index + 1 < lines.length) {
        const next = UNORDERED_ITEM.exec(lines[index + 1]);
        if (!next) break;
        items.push(next[1]);
        index += 1;
      }
      blocks.push(
        `<ul>${items.map(item => `<li>${cell(item)}</li>`).join("")}</ul>`
      );
      continue;
    }
    const ordered = ORDERED_ITEM.exec(line);
    if (ordered) {
      flushParagraph();
      const items: string[] = [ordered[1]];
      while (index + 1 < lines.length) {
        const next = ORDERED_ITEM.exec(lines[index + 1]);
        if (!next) break;
        items.push(next[1]);
        index += 1;
      }
      blocks.push(
        `<ol>${items.map(item => `<li>${cell(item)}</li>`).join("")}</ol>`
      );
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks.join("");
}
