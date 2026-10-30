/**
 * 路由守卫的静态路径清单（未登录可达 / 已登录不停留）。
 *
 * 两份清单职责不同，不能合并成一份：
 * - `PUBLIC_ROUTE_PATHS`：**未登录**时允许落地的页面。第三方 OAuth 回跳
 *   （`/oauth/callback`）必须在这里——IdP 带回的 code/state 就是凭据，未登录
 *   访问落地页是登录闭环的一环；漏登记会被守卫打回登录页并在 query 里丢掉 code。
 * - `GUEST_ONLY_ROUTE_PATHS`：**已登录**时不应停留的入口页（登录 / 邀请激活）。
 *   已登录访问这些路径时守卫保持原页面不动。OAuth 回跳不能进这份清单：账号绑定
 *   是已登录用户发起的，若按「已登录就退回原页」处理，绑定回调会被守卫吃掉。
 */

/** 未登录可达的静态路由（按 path 判定，忽略 query）。 */
export const PUBLIC_ROUTE_PATHS: readonly string[] = [
  "/login",
  "/invite/accept",
  "/oauth/callback",
  "/error/403",
  "/error/404",
  "/error/500"
];

/** 已登录时保持原页面的入口路由（登录 / 邀请激活）。 */
export const GUEST_ONLY_ROUTE_PATHS: readonly string[] = [
  "/login",
  "/invite/accept"
];

/** 未登录是否可以直接落到该路径。 */
export function isPublicRoutePath(path: string): boolean {
  return PUBLIC_ROUTE_PATHS.includes(path);
}

/** 已登录访问该路径时是否应保持原页面（不离开当前页）。 */
export function isGuestOnlyRoutePath(path: string): boolean {
  return GUEST_ONLY_ROUTE_PATHS.includes(path);
}
