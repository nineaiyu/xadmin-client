import { clearPendingApprovals } from "./pendingApproval";

/** 动态路由加载失败时的登录页兜底：h5 模式不能拼 hash 路由。 */
export function loginFallbackUrl(
  mode: string | undefined = import.meta.env.VITE_ROUTER_HISTORY
) {
  return mode === "h5" ? "/login" : "/#/login";
}

/** 模块停用页兜底地址（同上，按路由模式选择 hash / h5）。 */
export function moduleDisabledFallbackUrl(
  moduleId: string,
  mode: string | undefined = import.meta.env.VITE_ROUTER_HISTORY
) {
  const query = moduleId ? `?module=${encodeURIComponent(moduleId)}` : "";
  const path = `/error/module-disabled${query}`;
  return mode === "h5" ? path : `/#${path}`;
}

/** 登录态失效时跳转登录页并携带回跳地址（动态引入避免与路由模块循环依赖） */
export function redirectToLogin() {
  clearPendingApprovals();
  import("@/router")
    .then(({ router, resetRouter }) => {
      // 登录态失效：同步重置动态路由与权限缓存（含 localStorage 的 async-routes），
      // 避免下一个账号登录后复用上一个账号的菜单
      resetRouter();
      router.push({
        name: "Login",
        query: { redirect: router.currentRoute.value.fullPath }
      });
    })
    .catch(() => {
      window.location.href = loginFallbackUrl();
    });
}

/** 命中「功能模块已停用」网关时跳整页提示（带返回入口；动态引入避免与路由模块循环依赖） */
export function redirectToModuleDisabled(moduleId: string) {
  import("@/router")
    .then(({ router }) => {
      router.push({
        path: "/error/module-disabled",
        query: moduleId ? { module: moduleId } : {}
      });
    })
    .catch(() => {
      window.location.href = moduleDisabledFallbackUrl(moduleId);
    });
}
