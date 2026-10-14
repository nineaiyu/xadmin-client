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
 * 空白。因此以「内容实测所需宽度」为列宽下限（实测见 operationContentWidth.ts）：
 * - 无横向滚动时固定列不覆盖任何内容，直接按内容宽度渲染；
 * - 有滚动时按内容宽度（而非页面配置宽度）作为求对齐值的下限，仍以
 *   「页面配置宽度 + ALIGN_TOLERANCE」为上限，对齐不上就保持页面配置宽度。
 * 两条收敛路径都落在列边界上或不改动配置，因此都不会引入新的「半个字」。
 */

/** 多选列宽（Element Plus 默认语义宽度） */
export const SELECTION_COLUMN_WIDTH = 48;

/** 无显式宽度列的兜底宽度（与列渲染默认 minWidth 一致） */
export const DEFAULT_COLUMN_WIDTH = 120;

/** 页面未配置操作列宽度时的缺省值（列注入与列宽计算共用同一口径） */
export const DEFAULT_OPERATION_COLUMN_WIDTH = 200;

/**
 * 对齐容差：对齐值与「宽度基准」的差不超过该值时才应用对齐。
 *
 * 对齐只能保证「初始滚动位置」表头不被固定列裁出半个字——横向滚动后
 * 覆盖边界相对内容必然移动，裁切属滚动场景的固有观感。若为此把操作列
 * 长期加宽几十上百像素（实测访问日志页 140 → 226），视觉代价大于收益，
 * 也违背「所见即配置」的预期；因此只保留小幅修正（用户几乎无感），
 * 差异过大时严格按页面配置宽度渲染（此时容忍初始位置的跨界列）。
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
 *          有滚动时取「覆盖区左边界对齐某列右边界」且不大于
 *          `configuredWidth + ALIGN_TOLERANCE` 的对齐值——该值恒不小于
 *          `min(contentWidth, configuredWidth)`（配置放得下内容时即不会裁切内容，
 *          配置本就放不下时保持与配置同档，不反向撑宽）；对齐不划算时保持
 *          configuredWidth
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
  // 或首列都放不下时，放弃对齐、保持配置宽度
  if (accumulated < containerWidth * 0.35) return configuredWidth;

  const aligned = containerWidth - accumulated;
  // 对齐收益门槛：加宽幅度超过容差就保持配置宽度（见 ALIGN_TOLERANCE 注释）
  if (aligned - configuredWidth > ALIGN_TOLERANCE) return configuredWidth;
  return Math.max(floor, aligned);
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
