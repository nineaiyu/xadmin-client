/**
 * 账户设置页签与 URL 的同步工具。
 *
 * 背景：页签切换只改本地状态时，刷新 / 分享链接会回到第一个页签（个人信息）。
 * 但切换不能走 `router.replace({query})`——布局的 afterEach 会按「来源路由 path」
 * 取消在途请求（utils/http/routeCancel），刚挂载面板的首屏请求会被一并中止
 * （列表/元数据空白，且与取消是竞态、表现为偶发）。因此用 `history.replaceState`
 * 只改 URL、不触发路由导航：刷新与复制链接可回到当前页签，面板请求不受影响。
 *
 * 页签 key 与 URL 参数：`#/<path>?tab=<paneKey>`（hash 路由，query 在 hash 内）。
 */

/** 在 hash 串中写入 / 覆盖 tab 参数；保留路径与其余 query 参数。 */
export function buildTabHash(hash: string, paneKey: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", paneKey);
  const search = params.toString();
  return search ? `#${path}?${search}` : `#${path}`;
}

/** 把当前页签写入地址栏（不触发路由导航）。 */
export function syncTabQuery(paneKey: string): void {
  if (typeof window === "undefined" || !paneKey) return;
  const next = buildTabHash(window.location.hash, paneKey);
  window.history.replaceState(null, "", next);
}

/**
 * 解析落地页签：`?tab=` 命中可用页签时直达，非法 / 无权限时回落兜底页签，
 * 避免落到空白面板（OAuth 绑定回调经 `?tab=oauthBindings` 落地）。
 */
export function resolveInitialPane<T extends { key: string; auth?: boolean }>(
  panes: T[],
  queryTab: unknown,
  fallback: string
): string {
  const key = String(queryTab ?? "");
  return panes.some(item => item.key === key && item.auth !== false)
    ? key
    : fallback;
}
