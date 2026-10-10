/**
 * 表格自适应高度的纯计算与滚动容器测量（自 useTableMeasure 抽出，便于单测与复用）。
 *
 * 只靠固定底部预留（offsetBottom）算高度是不可靠的：页脚、卡片间距、浏览器滚动条
 * 占位等任一变化都会让页面比容器高出若干像素，而**只要高出 1px，内容区 el-scrollbar
 * 就会常驻一条几乎满高的滚动条**（观感上就是右侧一条竖线，且每个列表页都会出现）。
 * 因此以「滚动容器实测溢出量」自校正：溢出多少就回收多少，收敛到 0。
 */

/** 自适应高度底部预留缺省值：按「列表页直铺」口径实测得出 */
export const DEFAULT_ADAPTIVE_OFFSET_BOTTOM = 110;

/** 自适应高度的最小可用高度（低于此值表格不可用） */
export const MIN_ADAPTIVE_TABLE_HEIGHT = 260;

/** 按实测溢出量回收高度（不改变无溢出时的取值，且不低于最小可用高度） */
export function correctHeightByOverflow(
  height: number,
  overflow: number,
  min = MIN_ADAPTIVE_TABLE_HEIGHT
): number {
  if (!Number.isFinite(overflow) || overflow <= 1) return height;
  return Math.max(min, height - overflow);
}

/** 页面内容滚动容器（固定头布局下 `.app-main` 内即为 el-scrollbar） */
export function resolvePageScroller(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>(".el-scrollbar__wrap");
}

/** 滚动容器当前纵向溢出量（不存在滚动容器时为 0：页面整体滚动由页面自己兜底） */
export function resolvePageOverflow(el: HTMLElement): number {
  const scroller = resolvePageScroller(el);
  if (!scroller) return 0;
  return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}
