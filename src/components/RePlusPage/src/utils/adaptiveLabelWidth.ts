/**
 * 表单标签宽度自适应。
 *
 * 背景：新增/编辑弹窗此前固定 `label-width: 100px`，列标签较长（如
 * 「是否启用（自定义 input_type 演示）」）或标签后带帮助文本图标（如
 * 「间隔周期」+ 问号）时会被折成两行。这里按「当前表单内最长标签」计算统一
 * 宽度：标签不折行，同时保持同表单控件列起点对齐。
 *
 * 两道计算：
 * 1. `resolveAdaptiveLabelWidth`：渲染前的离屏估算（列元数据 → 宽度），
 *    作为首帧初值，避免弹窗打开瞬间的折行闪烁；
 * 2. `measureRenderedLabelWidth`：渲染后按真实 label 内容（文本 + 冒号 +
 *    帮助图标 + 字体/缩放影响）克隆实测校正，确保最终不折行。
 *
 * 不采用 Element Plus 的 `label-width="auto"`：它是逐项按内容取宽，长标签确实
 * 不折行，但控件列起点参差（`SettingItem.vue` 有同款结论）。
 */

/** 表单标签宽度下限：与既有固定值观感一致，短标签页面不产生视觉变化 */
const MIN_LABEL_WIDTH = 100;
/** 表单标签宽度上限：避免超长标签挤压控件列（超出部分仍会折行） */
const MAX_LABEL_WIDTH = 300;
/** 窄视口下标签最多占用视口宽度的比例：保证控件列不被压死（移动端全屏弹窗） */
const VIEWPORT_WIDTH_RATIO = 0.4;
/** `label-position="right"` 时标签尾部的冒号占位 */
const COLON_WIDTH = 6;
/** Element Plus 标签右内边距（估算用；实测路径读真实值） */
const LABEL_PADDING = 12;
/** 字段帮助文本图标（含间距）占位 */
const TOOLTIP_WIDTH = 24;
/** 测量与真实渲染的差异余量 */
const SAFETY_GAP = 4;

export interface AdaptiveLabelColumn {
  label?: unknown;
  tooltip?: unknown;
}

/** 全角字符（CJK 汉字、假名、韩文、全角标点）在 14px 字号下约占 1em 宽 */
const FULL_WIDTH_CHAR =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/** 无 DOM 环境（SSR / 单测）的文本宽度估算：全角 1em、半角 0.6em，偏保守 */
export function estimateLabelTextWidth(text: string, fontSize = 14): number {
  let width = 0;
  for (const char of text) {
    width += FULL_WIDTH_CHAR.test(char) ? fontSize : fontSize * 0.6;
  }
  return width;
}

/** 统一钳制：下限保证观感一致，上限避免挤压控件列（窄视口再按比例收敛） */
function clampLabelWidth(width: number): string {
  const viewportWidth =
    typeof window === "undefined" ? 0 : window.innerWidth || 0;
  const maxWidth = viewportWidth
    ? Math.min(
        MAX_LABEL_WIDTH,
        Math.max(viewportWidth * VIEWPORT_WIDTH_RATIO, MIN_LABEL_WIDTH)
      )
    : MAX_LABEL_WIDTH;
  return `${Math.min(Math.max(Math.ceil(width), MIN_LABEL_WIDTH), maxWidth)}px`;
}

/**
 * 用离屏 span 实测文本宽度。span 挂在 body 下继承页面字体，字号显式取
 * `--font-size-base`（Element Plus 的 `--el-font-size-base` 同源映射到它，
 * 见 style/tokens/ep-bridge.scss），因此既与标签字体一致，也跟随字号档位缩放；
 * 无 DOM 宽度（jsdom）时回退估算，保证纯函数可测。
 */
function measureAllTextWidths(texts: string[]): number[] {
  if (typeof document === "undefined" || texts.length === 0) {
    return texts.map(text => estimateLabelTextWidth(text));
  }
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;visibility:hidden;" +
    "white-space:nowrap;pointer-events:none;" +
    "font-size:var(--font-size-base);font-family:inherit;";
  document.body.appendChild(probe);
  const widths = texts.map(text => {
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  });
  probe.remove();
  return widths.map((width, index) =>
    width > 0 ? width : estimateLabelTextWidth(texts[index])
  );
}

/** 渲染前的离屏估算：列元数据 → 统一标签宽度 */
export function resolveAdaptiveLabelWidth(
  columns: AdaptiveLabelColumn[] = []
): string {
  const measured: Array<{ text: string; tooltip: boolean }> = [];
  for (const column of columns) {
    const label = column?.label;
    if (label === undefined || label === null || label === "") continue;
    measured.push({ text: String(label), tooltip: Boolean(column.tooltip) });
  }
  if (measured.length === 0) return clampLabelWidth(MIN_LABEL_WIDTH);

  const widths = measureAllTextWidths(measured.map(item => item.text));
  let widest = 0;
  widths.forEach((width, index) => {
    const total = width + (measured[index].tooltip ? TOOLTIP_WIDTH : 0);
    if (total > widest) widest = total;
  });
  return clampLabelWidth(widest + COLON_WIDTH + LABEL_PADDING + SAFETY_GAP);
}

/**
 * 渲染后按真实内容实测（克隆 + nowrap）：克隆节点保留标签的文本、冒号与
 * 帮助图标，并复制字体/间距，得到的宽度覆盖「图标实际尺寸、字体族差异、
 * 浏览器缩放」等估算无法覆盖的因素。返回 null 表示当前没有可测量的标签。
 */
export function measureRenderedLabelWidth(root: HTMLElement): string | null {
  if (typeof window === "undefined") return null;
  // 未激活页签内的标签宽度为 0（display:none），不参与测量
  const labels = Array.from(
    root.querySelectorAll<HTMLElement>(".el-form-item__label")
  ).filter(
    label =>
      Boolean(label.textContent?.trim()) &&
      label.getBoundingClientRect().width > 0
  );
  if (labels.length === 0) return null;

  let widest = 0;
  for (const label of labels) {
    const style = window.getComputedStyle(label);
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const probe = label.cloneNode(true) as HTMLElement;
    probe.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;visibility:hidden;" +
      "width:auto;max-width:none;padding:0;margin:0;white-space:nowrap;" +
      `display:${style.display};gap:${style.gap};font:${style.font};` +
      `letter-spacing:${style.letterSpacing};`;
    label.parentElement?.appendChild(probe);
    const contentWidth = probe.getBoundingClientRect().width;
    probe.remove();
    const total = contentWidth + paddingRight + SAFETY_GAP;
    if (total > widest) widest = total;
  }
  return widest > 0 ? clampLabelWidth(widest) : null;
}
