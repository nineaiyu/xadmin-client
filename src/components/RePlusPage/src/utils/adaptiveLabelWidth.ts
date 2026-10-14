/**
 * 表单标签宽度自适应。
 *
 * 背景：新增/编辑弹窗此前固定 `label-width: 100px`，列标签较长时（如
 * 「是否启用（自定义删除时间）」）会被折成两行。这里按「当前表单内最长标签」
 * 计算出统一宽度：标签不折行，同时保持同表单控件列起点对齐。
 *
 * 不采用 Element Plus 的 `label-width="auto"`：它是逐项按内容取宽，长标签确实
 * 不折行，但控件列起点参差（`SettingItem.vue` 有同款结论）。
 */

/** 表单标签宽度下限：与既有固定值观感一致，短标签页面不产生视觉变化 */
const MIN_LABEL_WIDTH = 100;
/** 表单标签宽度上限：避免超长标签挤压控件列（超出部分仍会折行） */
const MAX_LABEL_WIDTH = 240;
/** `label-position="right"` 时标签尾部的冒号占位 */
const COLON_WIDTH = 6;
/** Element Plus 标签右内边距（`--el-form-label-padding` 默认 12px） */
const LABEL_PADDING = 12;
/** 字段帮助文本（help_text）会在标签后渲染问号图标 */
const TOOLTIP_WIDTH = 20;
/** 测量字体与真实渲染字体的差异余量 */
const SAFETY_GAP = 2;

export interface AdaptiveLabelColumn {
  label?: unknown;
  tooltip?: unknown;
}

/** 全角字符（CJK 汉字、假名、韩文、全角标点）在 14px 字号下约占 1em 宽 */
const FULL_WIDTH_CHAR =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/**
 * 无 canvas 环境（SSR / 单测）的文本宽度估算：全角按 1em、半角按 0.6em，
 * 结果偏保守（宁宽不折行）。
 */
export function estimateLabelTextWidth(text: string, fontSize = 14): number {
  let width = 0;
  for (const char of text) {
    width += FULL_WIDTH_CHAR.test(char) ? fontSize : fontSize * 0.6;
  }
  return width;
}

let cachedMeasureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (cachedMeasureContext !== undefined) return cachedMeasureContext;
  if (typeof document === "undefined") {
    cachedMeasureContext = null;
    return null;
  }
  try {
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      const fontFamily =
        window.getComputedStyle(document.body).fontFamily || "sans-serif";
      context.font = `14px ${fontFamily}`;
    }
    cachedMeasureContext = context;
  } catch {
    cachedMeasureContext = null;
  }
  return cachedMeasureContext;
}

function measureLabelTextWidth(text: string): number {
  const context = getMeasureContext();
  return context
    ? context.measureText(text).width
    : estimateLabelTextWidth(text);
}

/**
 * 按列集合计算统一的标签宽度（含冒号与内边距），并钳制在
 * [`MIN_LABEL_WIDTH`, `MAX_LABEL_WIDTH`] 区间内。
 */
export function resolveAdaptiveLabelWidth(
  columns: AdaptiveLabelColumn[] = []
): string {
  let widest = 0;
  for (const column of columns) {
    const label = column?.label;
    if (label === undefined || label === null || label === "") continue;
    const textWidth =
      measureLabelTextWidth(String(label)) +
      (column.tooltip ? TOOLTIP_WIDTH : 0);
    if (textWidth > widest) widest = textWidth;
  }
  if (widest <= 0) return `${MIN_LABEL_WIDTH}px`;
  const width = Math.ceil(widest + COLON_WIDTH + LABEL_PADDING + SAFETY_GAP);
  return `${Math.min(Math.max(width, MIN_LABEL_WIDTH), MAX_LABEL_WIDTH)}px`;
}
