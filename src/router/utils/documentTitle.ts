/** 路由 matched 记录的最小标题面（避免测试构造完整 RouteLocation） */
export type MatchedTitle = { meta?: { title?: unknown } };

/**
 * 取最深层带 title 的匹配路由作为页面标题：
 * 父→子顺序倒序扫描，命中即止；无 title 返回 null（调用方保持原标题）。
 */
export function resolveMatchedTitle(
  matched: readonly MatchedTitle[],
  translate: (title: unknown) => string,
  siteTitle: string
): string | null {
  for (const item of [...matched].reverse()) {
    const title = item.meta?.title;
    if (!title) continue;
    const text = translate(title);
    return siteTitle ? `${text} | ${siteTitle}` : text;
  }
  return null;
}
