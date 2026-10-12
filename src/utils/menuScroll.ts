/**
 * 侧栏菜单滚动定位（纯函数）。
 *
 * 用途：路由切换或菜单数据变化后，若激活项不在滚动容器可视区内，把激活项滚入
 * 可视区；已在可视区内时返回 null（不产生无谓滚动，避免每次切页都跳动）。
 */

export interface MenuScrollMetrics {
  /** 激活项顶边（相对滚动内容顶部，即含已滚动距离的 offsetTop） */
  itemTop: number;
  /** 激活项高度 */
  itemHeight: number;
  /** 滚动容器当前 scrollTop */
  scrollTop: number;
  /** 滚动容器可视高度（clientHeight） */
  viewportHeight: number;
  /** 滚动容器内容总高（scrollHeight） */
  scrollHeight: number;
}

/** 计算目标 scrollTop；激活项已完整可见或容器不可滚动时返回 null */
export function computeMenuScrollTop(
  metrics: MenuScrollMetrics
): number | null {
  const { itemTop, itemHeight, scrollTop, viewportHeight, scrollHeight } =
    metrics;
  if (viewportHeight <= 0 || scrollHeight <= viewportHeight) return null;

  const itemBottom = itemTop + itemHeight;
  const viewTop = scrollTop;
  const viewBottom = scrollTop + viewportHeight;

  // 完整可见（含恰好贴合）：不滚动
  if (itemTop >= viewTop && itemBottom <= viewBottom) return null;

  // 向上越界：项顶对齐容器顶；向下越界：项底对齐容器底
  const target = itemTop < viewTop ? itemTop : itemBottom - viewportHeight;
  return Math.max(0, Math.min(target, scrollHeight - viewportHeight));
}
