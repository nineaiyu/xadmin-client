/**
 * 列表「尾部追加」判定（消息流 / 页签等场景的进入动画前置条件）。
 *
 * 列表项只在「新增」时播放一次进入动画：首次填充（进会话的首屏历史）、
 * 整批替换（切换会话）、前插（加载更早）与删除都不该逐个播放——否则会出现
 * 整屏消息同时浮现、上方插入的内容闪烁等噪声。
 */

/** 新列表是否为「前一列表 + 尾部追加」：严格更长，且旧列表逐项为新列表前缀 */
export function isTailAppend(
  prev: readonly string[],
  next: readonly string[]
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false;
  return prev.every((key, index) => key === next[index]);
}

/**
 * 「尾部追加」时返回新增行的 key 列表；其余形态（首次填充 / 整批替换 /
 * 前插 / 删除 / 原地更新）一律返回空数组。
 */
export function appendOnlyAddedKeys(
  prev: readonly string[],
  next: readonly string[]
): string[] {
  return isTailAppend(prev, next) ? next.slice(prev.length) : [];
}
