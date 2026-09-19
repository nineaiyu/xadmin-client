/**
 * 固定操作列宽度计算：把"覆盖区左边界"对齐到数据列边界。
 *
 * 背景（列表页表头被固定操作列裁切）：表格横向滚动时，右侧固定列 sticky 在
 * 容器右端，覆盖区为 `[容器宽 - 操作列宽, 容器宽]`。若某个数据列跨过覆盖区
 * 左边界，其表头内容（列名与问号图标）会被切掉一半，出现"半个字"。
 *
 * 解法：滚动存在时动态调整操作列宽度，使其左边界恰好落在某个列边界上——
 * 左侧列完整可见（内容不跨界）、右侧列整体被覆盖（内容不可见），表头无残缺
 * 字符；列宽合计与容器宽的关系不变（仍有横向滚动，交互不变）。
 */

/** 多选列宽（Element Plus 默认语义宽度） */
export const SELECTION_COLUMN_WIDTH = 48;

/** 无显式宽度列的兜底宽度（与列渲染默认 minWidth 一致） */
export const DEFAULT_COLUMN_WIDTH = 120;

/**
 * 计算操作列宽度。
 *
 * @param containerWidth 表格容器宽度（px；未测量到时为 0）
 * @param columnWidths   数据列宽序列（含多选列，不含操作列）
 * @param minWidth       页面为操作列配置的最小宽度
 * @returns 操作列宽度：无横向滚动时恒为 minWidth；有滚动时取
 *          「覆盖区左边界对齐某列右边界」的最小可行宽度
 */
export function resolveOperationColumnWidth(
  containerWidth: number,
  columnWidths: number[],
  minWidth: number
): number {
  if (!containerWidth || !columnWidths.length) return minWidth;
  const dataTotal = columnWidths.reduce((sum, width) => sum + width, 0);
  // 无横向滚动：固定列不浮动、不覆盖任何内容，保持页面配置宽度
  if (dataTotal + minWidth <= containerWidth) return minWidth;

  const boundaryLimit = containerWidth - minWidth;
  let accumulated = 0;
  for (const width of columnWidths) {
    if (accumulated + width > boundaryLimit) break;
    accumulated += width;
  }
  // 极端窄容器：可对齐边界落在容器前 35% 以左（继续对齐会让操作列占去大半屏）
  // 或首列都放不下时，放弃对齐、保持最小宽度
  if (accumulated < containerWidth * 0.35) return minWidth;

  const aligned = containerWidth - accumulated;
  return Math.max(minWidth, aligned);
}

/**
 * 从列表列定义提取"数据列宽序列"（顺序与渲染一致，含多选列、不含操作列）。
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
