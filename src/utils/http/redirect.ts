import { clearPendingApprovals } from "./pendingApproval";

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
      window.location.href = "/#/login";
    });
}
