/**
 * 固定操作列宽度计算：把「覆盖区左边界」对齐到数据列边界，并按内容收敛列宽。
 *
 * 背景（列表页表头被固定操作列裁切）：表格横向滚动时，右侧固定列 sticky 在
 * 容器右端，覆盖区为 `[容器宽 - 操作列宽, 容器宽]`。若某个数据列跨过覆盖区
 * 左边界，其表头内容（列名与问号图标）会被切掉一半，出现「半个字」。
 *
 * 解法：滚动存在时动态调整操作列宽度，使其左边界恰好落在某个列边界上——
 * 左侧列完整可见（内容不跨界）、右侧列整体被覆盖（内容不可见），表头无残缺
 * 字符；列宽合计与容器宽的关系不变（仍有横向滚动，交互不变）。
 *
 * 内容收敛（操作列按钮按权限/行数据显隐导致的「一个按钮占一大片列宽」）：
 * 操作列宽度是页面配置的固定值，而列内按钮受权限点与行数据影响（`show` 为假
 * 即不渲染）——只授予「管理」的用户会看到「一个按钮 + 260px 列宽」，右侧大片
 * 空白。因此以「内容实测所需宽度」为列宽基准（实测见 operationContentWidth.ts）：
 * - 无横向滚动时固定列不覆盖任何内容，直接按内容宽度渲染；
 * - 有滚动时对齐只作为「小幅修正」：对齐值比内容宽度多占不超过
 *   ALIGN_TOLERANCE 时才应用（此时覆盖区左边界落在列边界上，无跨界列头）；
 *   超出则按内容宽度渲染——宁可初始滚动位置有跨界列头（横向滚动后对齐本就
 *   不成立），也不让操作列长期占着一大片空白。
 */

/** 多选列宽（Element Plus 默认语义宽度） */
export const SELECTION_COLUMN_WIDTH = 48;

/** 无显式宽度列的兜底宽度（与列渲染默认 minWidth 一致） */
export const DEFAULT_COLUMN_WIDTH = 120;

/** 页面未配置操作列宽度时的缺省值（列注入与列宽计算共用同一口径） */
export const DEFAULT_OPERATION_COLUMN_WIDTH = 200;

/**
 * 对齐容差：对齐值比内容宽度多占的像素不超过该值时才应用对齐。
 *
 * 对齐只能保证「初始滚动位置」表头不被固定列裁出半个字——横向滚动后
 * 覆盖边界相对内容必然移动，裁切属滚动场景的固有观感。若为此把操作列
 * 长期加宽几十上百像素（实测访问日志页 140 → 226），视觉代价大于收益；
 * 因此只保留小幅修正（用户几乎无感），差异过大时按内容宽度渲染
 * （此时容忍初始位置的跨界列）。
 */
export const ALIGN_TOLERANCE = 30;

/**
 * 计算操作列宽度。
 *
 * @param containerWidth  表格容器宽度（px；未测量到时为 0）
 * @param columnWidths    数据列宽序列（含多选列，不含操作列）
 * @param contentWidth    操作列内容实测所需宽度（表头与行内容取最大 + 单元格
 *                        内边距；0 表示未测到，按页面配置宽度渲染）
 * @param configuredWidth 页面为操作列配置的宽度（列宽上限基准）
 * @returns 操作列宽度：无横向滚动时恒为 min(contentWidth, configuredWidth)；
 *          有滚动时优先取「覆盖区左边界对齐某列右边界」且比内容宽度多占不超过
 *          ALIGN_TOLERANCE 的对齐值；对齐代价过大或极端窄容器无法对齐时按
 *          min(contentWidth, configuredWidth) 渲染（此时允许初始滚动位置存在
 *          跨界列头）。内容比配置宽时不反向撑宽，保持与配置同档；内容未测到
 *          （0）时退化为按配置宽度渲染。
 */
export function resolveOperationColumnWidth(
  containerWidth: number,
  columnWidths: number[],
  contentWidth: number,
  configuredWidth: number
): number {
  // 内容不足时的下界。上限取页面配置：内容比配置宽（页面配置本就放不下）时
  // 仍按配置渲染——收敛只用于「配置明显大于内容」的场景，不反向撑宽（所见即配置）
  const floor =
    contentWidth > 0
      ? Math.min(contentWidth, configuredWidth)
      : configuredWidth;
  if (!containerWidth || !columnWidths.length) return configuredWidth;
  const dataTotal = columnWidths.reduce((sum, width) => sum + width, 0);
  // 无横向滚动：固定列不浮动、不覆盖任何内容，保持内容宽度
  if (dataTotal + floor <= containerWidth) return floor;

  const boundaryLimit = containerWidth - floor;
  let accumulated = 0;
  for (const width of columnWidths) {
    if (accumulated + width > boundaryLimit) break;
    accumulated += width;
  }
  // 极端窄容器：可对齐边界落在容器前 35% 以左（继续对齐会让操作列占去大半屏）
  // 或首列都放不下时，放弃对齐、按内容宽度渲染
  if (accumulated < containerWidth * 0.35) return floor;

  const aligned = containerWidth - accumulated;
  // 对齐只是「小幅修正」：为对齐多占的宽度超过容差时不值得——按钮变少后
  // 宁可让初始滚动位置的跨界列头被固定列覆盖，也不长期占着一大片空白
  if (aligned - floor > ALIGN_TOLERANCE) return floor;
  // 构造上 aligned 恒不小于 floor（accumulated ≤ containerWidth - floor），
  // 因此这里不会把内容裁掉
  return aligned;
}

/**
 * 从列表列定义提取「数据列宽序列」（顺序与渲染一致，含多选列、不含操作列）。
 *
 * Element Plus 在横向滚动时按列的 `width` / `minWidth` 渲染（无显式宽度用
 * 组件默认 minWidth），据此可精确得到列边界序列。
 */
export function collectDataColumnWidths(
  columns: Array<Record<string, unknown> | undefined | null>
): number[] {
  const widths: number[] = [];
  for (const column of columns ?? []) {
    if (!column || column["hide"] === true) continue;
    if (
      (column["_column"] as { key?: string } | undefined)?.key === "operation"
    )
      continue;
    if (column["type"] === "selection") {
      widths.push(SELECTION_COLUMN_WIDTH);
      continue;
    }
    const value = Number(column["width"] ?? column["minWidth"]);
    widths.push(
      Number.isFinite(value) && value > 0 ? value : DEFAULT_COLUMN_WIDTH
    );
  }
  return widths;
}
