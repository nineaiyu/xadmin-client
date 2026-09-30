import { storageLocal } from "@pureadmin/utils";

/**
 * 动态路由/权限快照（CachingAsyncRoutes）的存储键与清理入口。
 *
 * 快照由 `router/utils/async-routes` 写入 localStorage（命中时零等待渲染，
 * 响应内的内容指纹在后台比对自愈）。清理入口集中在此，供路由重置
 * （登出 / 登录态失效）与 HTTP 403（权限被收）自愈共用——避免键名多处硬编码漂移。
 */
export const ROUTE_SNAPSHOT_KEYS = [
  "async-routes",
  "async-auths",
  "async-routes-version"
] as const;

/** 清空快照（下次进入应用重新拉取路由与权限）。 */
export function clearRouteSnapshot(): void {
  const storage = storageLocal();
  for (const key of ROUTE_SNAPSHOT_KEYS) storage.removeItem(key);
}
