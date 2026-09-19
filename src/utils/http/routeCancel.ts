/**
 * 路由级在途请求登记与取消。
 *
 * 独立为零依赖模块：router/index 只需本模块（不引入 axios 实例模块），
 * 避免 router ↔ http 循环导入导致 vitest/SSR 下的 TDZ 崩溃。
 *
 * 键为**不含 query 的 path**（router.afterEach 以此维护当前路由）：同页 query 变化
 * （监控筛选、账号页签等）是视图状态更新而非离开页面——按 fullPath 粒度会把刚发起的
 * 请求误取消（如监控页写回筛选 query 后，history 请求恒被自己取消、图表空白）。
 */
const pendingRequests = new Map<string, Set<AbortController>>();

/** 当前路由 path 快照（不含 query，由 router.afterEach 维护） */
let currentRoutePath = "/";

export function setCurrentRoutePath(path: string): void {
  currentRoutePath = path;
}

export function getCurrentRoutePath(): string {
  return currentRoutePath;
}

export function registerPending(controller: AbortController): void {
  let controllers = pendingRequests.get(currentRoutePath);
  if (!controllers) {
    controllers = new Set();
    pendingRequests.set(currentRoutePath, controllers);
  }
  controllers.add(controller);
}

export function unregisterPending(controller: AbortController): void {
  if (!controller) return;
  for (const [routePath, controllers] of pendingRequests) {
    if (controllers.delete(controller) && controllers.size === 0) {
      pendingRequests.delete(routePath);
    }
  }
}

/** 取消指定路由的全部在途请求 */
export function cancelRoutePending(routePath: string): void {
  const controllers = pendingRequests.get(routePath);
  if (!controllers) return;
  pendingRequests.delete(routePath);
  controllers.forEach(controller => controller.abort());
}
