/**
 * UX-3：路由级在途请求登记与取消。
 *
 * 独立为零依赖模块：router/index 只需本模块（不引入 axios 实例模块），
 * 避免 router ↔ http 循环导入导致 vitest/SSR 下的 TDZ 崩溃。
 */
const pendingRequests = new Map<string, Set<AbortController>>();

/** 当前路由快照（由 router.afterEach 维护） */
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
