/**
 * 客户端关键词过滤：多字段「大小写不敏感包含」匹配（空关键词短路返回全量）。
 *
 * 口径：关键词与字段值均 trim + toLowerCase 后匹配；字段缺失（null / undefined）
 * 按空串处理；任一字段命中即保留。适用于已加载数据的本地过滤（列表 / 下拉伸缩 /
 * 预览弹窗），与远程搜索（服务端 icontains）互补。
 *
 * 用法（与 computed 组合）：
 * ```ts
 * const filtered = computed(() => filterByKeyword(items.value, keyword.value, item => [item.name, item.code]));
 * ```
 */
export function filterByKeyword<T>(
  items: readonly T[],
  keyword: string,
  fields: (item: T) => unknown[]
): T[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return items as T[];
  return items.filter(item =>
    fields(item).some(value =>
      String(value ?? "")
        .toLowerCase()
        .includes(kw)
    )
  );
}
