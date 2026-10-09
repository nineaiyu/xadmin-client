import {
  createRouter,
  type RouteRecordRaw,
  type Router,
  type RouterHistory
} from "vue-router";
import { constantRoutes, pathMatchRoute } from "./constants";
import remainingRouter from "./modules/remaining";
import { getHistoryMode } from "./utils/history";

/**
 * 路由实例（叶子模块）。
 *
 * 从 router/index.ts 拆出：实例只依赖静态路由常量与历史模式解析，
 * 不含守卫对 store 的引用——多标签 store / 通知 store 等反向引用本实例
 * （`@/router/router`）时不成环。守卫与 `resetRouter` 仍在 router/index.ts。
 */
const asRouteRecords = (value: unknown): RouteRecordRaw[] =>
  value as RouteRecordRaw[];

/** 创建路由实例 */
export const router: Router = createRouter({
  // VITE_ROUTER_HISTORY 由构建配置保证为合法值（hash / h5[,base]），未命中场景不发生后端兜底
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY) as RouterHistory,
  // vue-router 5 的 RouteRecordRaw 联合判定不认宽松的 RouteConfigsTable 接口（redirect 可选性），
  // 运行时 remainingRoutes 即合法路由，此处按原始路由边界收窄
  routes: constantRoutes.concat(
    ...asRouteRecords(remainingRouter),
    pathMatchRoute
  ),
  strict: true,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(resolve => {
      if (savedPosition) {
        return savedPosition;
      } else {
        if (from.meta.saveSrollTop) {
          const top: number =
            document.documentElement.scrollTop || document.body.scrollTop;
          resolve({ left: 0, top });
        }
      }
    });
  }
});

export default router;
