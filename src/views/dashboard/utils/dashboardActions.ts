/** 卡片上下移一位（编辑态键盘/按钮排序；越界返回原数组） */
export function moveCardInList<T extends { id: string }>(
  list: T[],
  id: string,
  offset: number
): T[] {
  const index = list.findIndex(card => card.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
