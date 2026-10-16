/**
 * 表格自适应高度的纯计算与容器测量（自 useTableMeasure 抽出，便于单测与复用）。
 */

/** 自适应高度底部预留缺省值：按「列表页直铺」口径实测得出 */
export const DEFAULT_ADAPTIVE_OFFSET_BOTTOM = 110;

/** 自适应高度的最小可用高度（低于此值表格不可用） */
export const MIN_ADAPTIVE_TABLE_HEIGHT = 260;

/** 页面内容容器（固定头布局下 `.el-scrollbar__view` 内的 flex 内容块） */
export function resolvePageContentBox(el: Element | null | undefined) {
  return el?.closest<HTMLElement>("#main-content") ?? null;
}

/**
 * 内容容器的闲置量（**带符号**，px）：
 * 正数 = 容器还能容纳多少高度（内容未占满，表格可以长高）；
 * 负数 = 内容已超出容器多少（需要收缩）；
 * 无内容容器或内容尚未渲染（占用为 0）时返回 null，调用方按期望高度处理。
 *
 * 为什么不用滚动容器的 `scrollHeight - clientHeight`：内容不足时
 * `.el-scrollbar__view` 作为 flex 子项被拉伸到容器高（align-items: stretch，
 * 内容块的 flex-grow 再吃掉剩余空间），该差值恒为 0——「还有多少空闲」这一信息
 * 被 flex 分配吃掉了。后果是表格只能收缩、不能增长：刷新后搜索区由元数据占位态
 * 收缩（106 → 56px，表格顶整体上移），表格高度却停留在挂载时按旧 top 算出的值，
 * 直到窗口 resize 触发库内 setAdaptive 重算才补回来——表现为「刷新后底部留白大，
 * 随手拖动一下宽度就恢复正常」，而拖动侧栏/展开搜索区这类不改窗口宽度的布局变化
 * 永远等不到那次重算。
 *
 * 改为按内容容器实测：容器可分配高与「内容实际占用」之差，增长与收缩共用同一度量，
 * 且与页面是否配了 offsetBottom 无关（offsetBottom 只作为期望高度的保守估计上限）。
 */
export function resolveContentSlack(
  root: Element | null | undefined
): number | null {
  const container = resolvePageContentBox(root);
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  // 内容实际占用：取所有直接子节点底边的最大值（弹窗/浮层等脱离文档流的子节点不参与）
  let used = 0;
  for (const child of Array.from(container.children)) {
    used = Math.max(used, child.getBoundingClientRect().bottom - rect.top);
  }
  if (used <= 0) return null;
  return Math.round(container.clientHeight - used);
}

/**
 * 自适应高度的稳态解（一步到位，纯函数）：
 *
 *   avail = 当前高度 + 闲置量       // 内容容器当前还能容纳的表格高度
 *   next  = clamp(min(期望高度, avail), 最小可用高度)
 *
 * 为什么用解析解，而不是「先写期望高度、再按实测溢出回收」：后者写完后溢出归零，
 * 下一轮观察器又按期望高度恢复，两个状态互推——拖拽窗口宽度后表现为「抖两次才稳定」，
 * 窄视口分页换行时更会每帧互推（实测 240 帧 238 次高度变化，内容区整片残影）。
 *
 * 解析解直接给出稳态值，写回后再测必然满足「闲置量 ≤ 0 或与期望取小后不变」，
 * 因此一轮收敛：
 * - 还有空闲（闲置量为正）：增长到期望高度，或增长到把空闲用尽为止；
 * - 已溢出（闲置量为负）：收缩到刚好填满容器；
 * - 恰好占满（闲置量为 0）：保持当前高度（既不长也不收）；
 * - 期望高度只是「可用高度的估计上限」（视口高 - 表格顶 - 底部预留），
 *   它大于实际可用空间时由 avail 收口，小于时由期望高度收口，都不会溢出。
 */
export function resolveAdaptiveHeight(
  currentHeight: number,
  desired: number,
  slack: number | null,
  min = MIN_ADAPTIVE_TABLE_HEIGHT
): number {
  const maxHeight = Math.max(min, Math.round(desired));
  if (slack === null || !Number.isFinite(slack)) return maxHeight;
  const avail = Math.round(currentHeight) + Math.round(slack);
  return Math.max(min, Math.min(maxHeight, avail));
}
