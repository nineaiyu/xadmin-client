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

/**
 * 容器可用宽度统一取 `offsetWidth`（border-box）。
 *
 * 滑块内部一直按 `offsetWidth` 算可移动距离；父组件若用 ResizeObserver 的
 * `contentRect.width`（content-box），会比滑块自身的 max 少算两侧边框，
 * 末端答案相差 1~2 自然像素，把后端 4px 容差吃掉一半。两处统一到本函数。
 */
export function measureWidth(element?: HTMLElement | null): number {
  return element?.offsetWidth ?? 0;
}
