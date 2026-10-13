/**
 * 表格自适应高度的纯计算与滚动容器测量（自 useTableMeasure 抽出，便于单测与复用）。
 */

/** 自适应高度底部预留缺省值：按「列表页直铺」口径实测得出 */
export const DEFAULT_ADAPTIVE_OFFSET_BOTTOM = 110;

/** 自适应高度的最小可用高度（低于此值表格不可用） */
export const MIN_ADAPTIVE_TABLE_HEIGHT = 260;

/** 页面内容滚动容器（固定头布局下 `.app-main` 内即为 el-scrollbar） */
export function resolvePageScroller(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>(".el-scrollbar__wrap");
}

/**
 * 滚动容器当前纵向溢出量（**带符号**，不存在滚动容器时为 0）：
 * 正数 = 内容超出容器多少像素；负数 = 容器还能容纳多少像素。
 *
 * 必须保留符号：它是「表格高度还能分配多少空间」的唯一度量，截断到 0 会丢掉
 * 剩余空闲量，拖宽后高度无法再长回期望值（表现为表格一直比该有的矮）。
 */
export function resolvePageOverflow(el: HTMLElement): number {
  const scroller = resolvePageScroller(el);
  if (!scroller) return 0;
  return scroller.scrollHeight - scroller.clientHeight;
}

/**
 * 自适应高度的稳态解（一步到位，纯函数）：
 *
 *   maxFit = 当前高度 - 带符号溢出    // 当前布局下「刚好填满滚动容器」的高度
 *   next   = clamp(min(期望高度, maxFit), 最小可用高度)
 *
 * 为什么用解析解，而不是「先写期望高度、再按实测溢出回收」：后者写完后溢出归零，
 * 下一轮 ResizeObserver 又按期望高度恢复，两个状态互推——拖拽窗口宽度后表现为
 * 「抖两次才稳定」，窄视口分页换行时更会每帧互推（实测 240 帧 238 次高度变化，
 * 内容区整片残影）。
 *
 * 解析解直接给出稳态值，写回后再测必然满足 `溢出 ≤ 0`，与期望取小后取值不变，
 * 因此一轮收敛：
 * - 溢出为正：`maxFit < 当前高度` → 收缩到刚好填满；
 * - 溢出为负（仍有空闲）：`maxFit > 当前高度` → 增长到期望高度或填满为止；
 * - 期望高度只是「可用高度的估计上限」（视口高 - 表格顶 - 底部预留），
 *   它大于实际可用空间时由 `maxFit` 收口，小于时由期望高度收口，都不会溢出。
 */
export function resolveAdaptiveHeight(
  currentHeight: number,
  desired: number,
  overflow: number,
  min = MIN_ADAPTIVE_TABLE_HEIGHT
): number {
  if (!Number.isFinite(overflow)) return Math.max(min, Math.round(desired));
  const maxFit = Math.round(currentHeight) - Math.round(overflow);
  return Math.max(min, Math.min(Math.round(desired), maxFit));
}
