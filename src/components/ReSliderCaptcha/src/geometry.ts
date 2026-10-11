/**
 * 滑块可移动的最大 left 值：容器宽减去滑块宽与右侧间隙。
 * 保证非负（容器尚未量测时为 0，此时视为不可通过）。
 */
export function actionOffset(
  wrapperWidth: number,
  actionWidth: number,
  gap = 6
): number {
  return Math.max(wrapperWidth - actionWidth - gap, 0);
}
