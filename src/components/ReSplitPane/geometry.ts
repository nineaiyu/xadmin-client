/** 拖拽位置 → 左/上栏百分比（保留两位小数）；容器尺寸为 0 时返回 null（不可计算） */
export function calcSplitPercent(
  currentPage: number,
  offset: number,
  totalSize: number
): number | null {
  if (!Number.isFinite(totalSize) || totalSize <= 0) return null;
  return Math.floor(((currentPage - offset) / totalSize) * 10000) / 100;
}

/** 百分比是否在双侧最小边界内 */
export function isPercentAllowed(percent: number, minPercent: number): boolean {
  return percent > minPercent && percent < 100 - minPercent;
}
