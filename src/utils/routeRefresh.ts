import NProgress from "@/utils/progress";
import { handleAliveRoute } from "@/router/utils";
import type { LocationQueryRaw, Router } from "vue-router";

/**
 * 刷新当前路由：redirect 中转触发组件重建 + keep-alive 缓存清理。
 *
 * 页签右键菜单、页签条刷新按钮与顶栏刷新按钮共用同一口径；
 * 路由实例由调用方传入（避免 utils → router 顶层静态依赖成环）。
 */
export function refreshCurrentRoute(
  router: Router,
  route: { fullPath: string; query: LocationQueryRaw }
) {
  NProgress.start();
  router.replace({ path: "/redirect" + route.fullPath, query: route.query });
  handleAliveRoute(route as ToRouteType, "refresh");
  NProgress.done();
}
