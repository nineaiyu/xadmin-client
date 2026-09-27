/**
 * 字段排序的数据路径（拖拽与上移/下移按钮共用同一实现）。
 *
 * 拖拽手势本身由 sortablejs 负责（真实 DOM 位移在回调里撤销后交回 Vue 按数据重排），
 * 本函数只做「数组位移」这一确定性步骤——单测覆盖，手势层不重复测。
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
