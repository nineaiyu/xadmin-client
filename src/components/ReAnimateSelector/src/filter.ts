/** 动画类名过滤：大小写敏感的 includes（与 EP filterable 的输入语义一致） */
export function filterAnimates(
  list: readonly string[],
  keyword: string
): string[] {
  return list.filter(item => item.includes(keyword));
}
