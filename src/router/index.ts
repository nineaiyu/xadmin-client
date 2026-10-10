import "@/utils/sso";
import Cookies from "js-cookie";
import { getConfig } from "@/config";
import NProgress from "@/utils/progress";
import { transformI18n } from "@/plugins/i18n";
import {
  cancelRoutePending,
  setCurrentRoutePath
} from "@/utils/http/routeCancel";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useUserStoreHook } from "@/store/modules/user";
import type { RouteConfigs } from "@/layout/types";
import { isUrl, openLink, cloneDeep, isAllEmpty } from "@pureadmin/utils";
import { clearRouteSnapshot } from "@/utils/routeSnapshot";
import { readConfigurePreferences } from "@/utils/preferences";
import {
  getTopMenu,
  initRouter,
  findRouteByPath,
  handleAliveRoute,
  isOneOfArray
} from "./utils";
import remainingRouter from "./modules/remaining";
import type { Router, RouteRecordRaw } from "vue-router";
import {
  removeToken,
  multipleTabsKey,
  getRefreshToken,
  getToken
} from "@/utils/auth";
import { router } from "./router";
import {
  constantMenus,
  constantRoutes,
  initConstantRoutes,
  pathMatchRoute,
  remainingPaths
} from "./constants";

/** 标签页记录收窄（multiTags 入参形态：运行时只消费 path / name / meta） */
const asRouteConfig = (value: unknown): RouteConfigs => value as RouteConfigs;

/** 原始路由数组收窄（remainingRouter 记录与 RouteRecordRaw 联合类型不兼容判定） */
const asRouteRecords = (value: unknown): RouteRecordRaw[] =>
  value as RouteRecordRaw[];

// 向后兼容再导出（router 实例与静态路由常量现由叶子模块提供）
export { router, constantMenus, constantRoutes, remainingPaths };

/** 记录已经加载的页面路径 */
const loadedPaths = new Set<string>();

/** 重置已加载页面记录 */
export function resetLoadedPaths() {
  loadedPaths.clear();
}

/** 重置路由 */
export function resetRouter() {
  router.clearRoutes();
  for (const route of initConstantRoutes.concat(
    ...asRouteRecords(remainingRouter)
  )) {
    router.addRoute(route);
  }
  router.addRoute(pathMatchRoute);
  router.options.routes = cloneDeep(constantRoutes);
  usePermissionStoreHook().clearAllCachePage();
  // 一并清掉动态路由/权限的本地缓存（CachingAsyncRoutes 开启时写入）：
  // 否则下一个账号登录会命中上一个账号的菜单缓存
  clearRouteSnapshot();
  resetLoadedPaths();
}

/** 路由白名单（未登录可达；邀请激活页令牌即凭据） */
const whiteList = ["/login", "/invite/accept"];

const { VITE_HIDE_HOME } = import.meta.env;

router.beforeEach((to: ToRouteType, _from) => {
  to.meta.loaded = loadedPaths.has(to.path);

  if (!to.meta.loaded) {
    NProgress.start();
  }

  if (to.meta?.keepAlive) {
    handleAliveRoute(to, "add");
    // 页面整体刷新和点击标签页刷新
    if (_from.name === undefined || _from.name === "Redirect") {
      handleAliveRoute(to);
    }
  }
  const refresh = getRefreshToken();
  const externalLink = isUrl(to?.name as string);
  // 动态标题关闭时保持平台标题不随路由变化（偏好在设置面板 →「动态标题」）
  if (!externalLink && readConfigurePreferences().dynamicTitle !== false) {
    to.matched.some(item => {
      if (!item.meta.title) return "";
      const Title = getConfig().Title;
      if (Title)
        document.title = `${transformI18n(item.meta.title)} | ${Title}`;
      else document.title = transformI18n(item.meta.title);
    });
  }

  /** 如果已经登录并存在登录信息后不能跳转到路由白名单，而是继续保持在当前页面 */
  function toCorrectRoute() {
    if (to.path === "/login" && getToken()) {
      return (to?.query?.redirect as string) ?? "/";
    }
    // 按 path 判断（白名单页面可能带 query，如邀请激活 token）
    return whiteList.includes(to.path) ? _from.fullPath : undefined;
  }

  if (Cookies.get(multipleTabsKey) && refresh) {
    // 无权限跳转403页面（meta.roles 配置的路由需与当前用户角色有交集）
    if (
      to.meta?.roles &&
      !isOneOfArray(to.meta?.roles, useUserStoreHook().roles)
    ) {
      return { path: "/error/403" };
    }
    // 开启隐藏首页后在浏览器地址栏手动输入首页welcome路由则跳转到404页面
    if (VITE_HIDE_HOME === "true" && to.fullPath === "/welcome") {
      return { path: "/error/404" };
    }
    if (_from?.name) {
      // name为超链接
      if (externalLink) {
        openLink(to?.name as string);
        NProgress.done();
        return false;
      } else {
        return toCorrectRoute();
      }
    } else {
      // 刷新
      if (
        usePermissionStoreHook().wholeMenus.length === 0 &&
        to.path !== "/login"
      ) {
        initRouter()
          .then((router: Router) => {
            if (!useMultiTagsStoreHook().getMultiTagsCache) {
              const { path } = to;
              const route = findRouteByPath(
                path,
                router.options.routes[0].children ?? []
              );
              getTopMenu(true);
              // query、params模式路由传参数的标签页不在此处处理
              if (route && route.meta?.title) {
                if (isAllEmpty(route.parentId) && route.meta?.backstage) {
                  // 此处为动态顶级路由（目录）：目录型记录必然带 children，边界断言保持运行时原语义
                  const { path, name, meta } = (
                    route.children as RouteRecordRaw[]
                  )[0];
                  useMultiTagsStoreHook().handleTags(
                    "push",
                    asRouteConfig({ path, name, meta })
                  );
                } else {
                  const { path, name, meta } = route;
                  useMultiTagsStoreHook().handleTags(
                    "push",
                    asRouteConfig({ path, name, meta })
                  );
                }
              }
            }
            // 确保动态路由完全加入路由列表并且不影响静态路由（注意：动态路由刷新时router.beforeEach可能会触发两次，第一次触发动态路由还未完全添加，第二次动态路由才完全添加到路由列表，如果需要在router.beforeEach做一些判断可以在to.name存在的条件下去判断，这样就只会触发一次）
            // to.name 为 "pathMatch" 时说明首次导航被顶层兜底路由接住（如强制刷新动态路由页），路由注册完成后同样需要重新跳转
            if (isAllEmpty(to.name) || to.name === "pathMatch")
              router.push(to.fullPath);
          })
          .catch(() => {
            // 动态路由拉取/注册失败（后端 5xx/网络异常）：跳静态的 /error/500 可重试页，
            // 而非停留在无菜单的兜底路由。已在 500 页时不再重复跳转，避免守卫→initRouter
            // 失败→再跳 500 的循环；500 页返回按钮 router.push('/') 会重新触发 initRouter 重试
            if (to.path !== "/error/500") {
              router.push("/error/500").catch(() => undefined);
            }
          });
      }
      return toCorrectRoute();
    }
  } else {
    if (to.path !== "/login") {
      if (whiteList.indexOf(to.path) !== -1) {
        return true;
      } else {
        removeToken();
        return { path: "/login", query: { redirect: to.fullPath } };
      }
    } else {
      return true;
    }
  }
});

router.afterEach((to, from) => {
  loadedPaths.add(to.path);
  NProgress.done();
  // 路由切换时取消来源页面的在途请求（登记见 utils/http/routeCancel）。
  // 以 path（不含 query）为粒度：同页 query 变化（监控筛选/账号页签）属视图状态更新，
  // 按 fullPath 粒度会取消刚发起的请求（图表恒空、表格偶发空白）。
  // from.matched 为空表示首次导航（强刷/新开标签）而非"离开某页"——守卫链内
  // 发出的 boot 请求（getAsyncRoutes 等）此刻仍归属初始路径，误取消会白屏
  if (to.path !== from.path && from.matched.length > 0) {
    cancelRoutePending(from.path);
  }
  setCurrentRoutePath(to.path);
});

export default router;
