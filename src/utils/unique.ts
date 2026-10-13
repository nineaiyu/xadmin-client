/**
 * 数组去重（项目收口，保序：首见元素保留）。
 *
 * 与 `lodash-es` 的 `uniq` 等价（SameValueZero 语义：`NaN` 视为同值），
 * 但避免为单点需求引入整包依赖；同时统一替代散落的
 * `[...a, ...b].filter((item, index) => merged.indexOf(item) === index)`
 * 手写实现（三处重复后收口于此）。
 */

/** 单数组保序去重 */
export function unique<T>(list: readonly T[]): T[] {
  return [...new Set(list)];
}

/** 合并多个数组并保序去重（后者中的新元素按出现顺序追加） */
export function mergeUnique<T>(...lists: readonly (readonly T[])[]): T[] {
  return unique(lists.flat());
}
