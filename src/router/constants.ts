import { cloneDeep } from "@pureadmin/utils";
import { defineComponent } from "vue";
import type { RouteRecordRaw } from "vue-router";
import { buildHierarchyTree } from "@/utils/tree";
import remainingRouter from "./modules/remaining";
import {
  ascending,
  formatFlatteningRoutes,
  formatTwoStageRoutes
} from "./utils/route-tree";

/**
 * 路由静态常量（叶子模块）。
 *
 * 由 router/index.ts 拆出：常量只依赖纯工具与静态路由表，不含任何 store 引用，
 * 供多标签 store、权限 store 等反向引用而不成环（原先经 router/index.ts 引入，
 * 会把路由守卫对 store 的依赖一并传播成环）。
 */

/**
 * 自动导入全部静态路由，无需再手动引入！匹配 src/router/modules 目录
 * （任何嵌套级别）中具有 .ts 扩展名的所有文件，除了 remaining.ts 文件。
 * 匹配规则见 https://github.com/mrmlnc/fast-glob#basic-syntax 与
 * https://cn.vitejs.dev/guide/features.html#negative-patterns
 */
const modules = import.meta.glob<{ default: RouteConfigsTable }>(
  ["./modules/**/*.ts", "!./modules/**/remaining.ts"],
  {
    eager: true
  }
);

/** 原始静态路由（未做任何处理） */
const routes: RouteConfigsTable[] = [];

Object.keys(modules).forEach(key => {
  routes.push(modules[key].default);
});

/**
 * 路由类型边界收窄（单点收敛，替代各调用点的双重断言）：
 * 静态路由配置表（宽松的 RouteConfigsTable 接口）与 vue-router 的
 * RouteRecordRaw 联合类型互不兼容判定，但运行时形态即合法路由记录
 * （含 children 递归与 meta），此处在类型边界统一收窄。
 */
const asRouteRecords = (value: unknown): RouteRecordRaw[] =>
  value as RouteRecordRaw[];

/** 导出处理后的静态路由（三级及以上的路由全部拍成二级） */
export const constantRoutes: Array<RouteRecordRaw> = formatTwoStageRoutes(
  formatFlatteningRoutes(
    asRouteRecords(buildHierarchyTree(ascending(routes.flat(Infinity))))
  )
);

/** 初始的静态路由，用于退出登录时重置路由 */
export const initConstantRoutes: Array<RouteRecordRaw> =
  cloneDeep(constantRoutes);

/** 用于渲染菜单，保持原始层级 */
export const constantMenus: Array<RouteRecordRaw> = asRouteRecords(
  ascending(routes.flat(Infinity))
).concat(...asRouteRecords(remainingRouter));

/** 不参与菜单的路由 */
export const remainingPaths = remainingRouter.map(v => v.path);

/**
 * 固定标签页路由（`meta.fixedTag`）：多标签 store 冷启动时的静态来源。
 * 只取静态路由部分（动态路由不下发 fixedTag），与权限 store 拍平结果一致。
 */
export const fixedTagRoutes: Array<RouteRecordRaw> = formatFlatteningRoutes(
  constantMenus
).filter(v => v?.meta?.fixedTag);

/**
 * 顶层兜底路由（无 redirect、无组件），必须在创建路由实例时就注册：
 * 强制刷新动态路由页面（如 /system/field/index）时，首次导航发生在 initRouter
 * 注册异步路由之前，若无兜底匹配会触发 [VUE_ROUTER_R0004] No match found 警告。
 * 此处仅让首次导航命中以消除警告，to.fullPath 仍为原路径，待 initRouter 完成后
 * 由守卫重新 push；动态路由就绪后 utils.ts 的 addPathMatch() 会用 redirect 到
 * /error/404 的同名路由替换本记录，恢复未匹配路径跳 404 的行为。
 */
export const pathMatchRoute: RouteRecordRaw = {
  path: "/:pathMatch(.*)",
  name: "pathMatch",
  // 必须是组件对象而非普通箭头函数：vue-router 会把不带 render 的函数当懒加载器
  // 调用，返回 null 会在 extractComponentsGuards 中报 'catch' in null，
  // 导致首次导航失败、router.isReady() 永不结束、应用无法挂载（黑屏）
  component: defineComponent({ name: "PathMatchEmpty", render: () => null })
};
