import type { RouteMeta, RouteRecordRaw, Router } from "vue-router";
import { cloneDeep, isUrl, storageLocal } from "@pureadmin/utils";
import { getConfig } from "@/config";
import { type RouteConfigs, routerArrays } from "@/layout/types";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
// 动态路由
import { getAsyncRoutes } from "@/api/routes";
import { useUserStoreHook } from "@/store/modules/user";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

import { router } from "../index";
import { resolveComponentKey } from "./resolve-component";
import { ascending, formatFlatteningRoutes } from "./route-tree";

const IFrame = () => import("@/layout/frame.vue");
// https://cn.vitejs.dev/guide/features.html#glob-import
const modulesRoutes = import.meta.glob("/src/views/**/*.{vue,tsx}");

function addPathMatch() {
  // 动态路由就绪后，用 redirect 版本替换 router/index.ts 中预注册的无组件兜底
  // （同名 addRoute 会替换旧记录），保证未匹配路径仍能跳转 404 页
  router.addRoute({
    path: "/:pathMatch(.*)",
    name: "pathMatch",
    redirect: "/error/404"
  });
}

/** 处理动态路由（后端返回的路由） */
function handleAsyncRoutes(routeList: RouteRecordRaw[], authList: string[]) {
  usePermissionStoreHook().handleWholeAuths(authList);
  if (routeList.length === 0) {
    usePermissionStoreHook().handleWholeMenus(routeList);
  } else {
    // 根路由（constantRoutes 首条 Layout 记录）的 children 由构造期保证存在，运行时对该数组原地增删
    const rootChildren = router.options.routes[0].children as RouteRecordRaw[];
    formatFlatteningRoutes(addAsyncRoutes(routeList) ?? []).map(
      (v: RouteRecordRaw) => {
        // 防止重复添加路由
        if (rootChildren.findIndex(value => value.path === v.path) !== -1) {
          return;
        } else {
          // 切记将路由push到routes后还需要使用addRoute，这样路由才能正常跳转
          rootChildren.push(v);
          // 最终路由进行升序
          ascending(rootChildren);
          // 后端目录型路由（含 children、子级为绝对 path）若连同 children 一起注册，
          // 会与拍平后的同级子记录产生同 path 的嵌套/扁平双 matcher，最终命中哪条
          // 取决于注册顺序；目录被命中时其组件无 <router-view>，子路由渲染被整体
          // 遮蔽（页面白屏）。matcher 只注册拍平记录，目录访问由 redirect 兜底；
          // options.routes 中保留完整父子树供面包屑/菜单查找。
          const matcherRecord: RouteRecordRaw =
            (v.children?.length ?? 0) > 0
              ? ({ ...v, children: undefined } as RouteRecordRaw)
              : v;
          if (!matcherRecord.name || !router.hasRoute(matcherRecord.name))
            router.addRoute(matcherRecord);
          const flattenRouters = router.getRoutes().find(n => n.path === "/");
          // 保持router.options.routes[0].children与path为"/"的children一致，防止数据不一致导致异常
          if (flattenRouters) {
            flattenRouters.children = rootChildren.map(c =>
              (c.children?.length ?? 0) > 0
                ? ({ ...c, children: undefined } as RouteRecordRaw)
                : c
            );
            router.addRoute(flattenRouters);
          }
        }
      }
    );
    usePermissionStoreHook().handleWholeMenus(routeList);
  }
  if (!useMultiTagsStoreHook().getMultiTagsCache) {
    useMultiTagsStoreHook().handleTags("equal", [
      ...routerArrays,
      ...usePermissionStoreHook().flatteningRoutes.filter(
        v => v?.meta?.fixedTag
      )
    ] as RouteConfigs[]);
  }
  addPathMatch();
}

/** 初始化路由（`new Promise` 写法防止在异步请求中造成无限循环）*/
function initRouter(loadConfig: boolean = false): Promise<Router> {
  if (loadConfig) {
    useSiteConfigStoreHook().getSiteConfig();
  }
  useUserStoreHook()
    .getUserInfo()
    .then(() => {
      useUserStoreHook().messageHandler();
    })
    .catch(error => {
      // 用户信息拉取失败（凭证失效/网络异常）：不建立 WS，避免半登录态下无谓的重连风暴
      console.error("get user info failed", error);
    });

  if (getConfig()?.CachingAsyncRoutes) {
    // 开启动态路由缓存本地localStorage
    const key = "async-routes";
    const authKey = "async-auths";
    const asyncRouteList = storageLocal().getItem<RouteRecordRaw[]>(key);
    const asyncAuthList = storageLocal().getItem<string[]>(authKey);
    if (asyncRouteList && asyncRouteList?.length > 0) {
      return new Promise(resolve => {
        handleAsyncRoutes(asyncRouteList, asyncAuthList ?? []);
        resolve(router);
      });
    } else {
      return new Promise(resolve => {
        getAsyncRoutes().then(({ data, auths }) => {
          handleAsyncRoutes(cloneDeep(data), auths);
          storageLocal().setItem(key, data);
          storageLocal().setItem(authKey, auths);
          resolve(router);
        });
      });
    }
  } else {
    return new Promise(resolve => {
      getAsyncRoutes().then(({ data, auths }) => {
        handleAsyncRoutes(cloneDeep(data), auths);
        resolve(router);
      });
    });
  }
}

/** 过滤后端传来的动态路由 重新生成规范路由 */
function addAsyncRoutes(
  arrRoutes: Array<RouteRecordRaw>
): Array<RouteRecordRaw> | undefined {
  if (!arrRoutes || !arrRoutes.length) return;
  const modulesRoutesKeys = Object.keys(modulesRoutes);
  arrRoutes.forEach((v: RouteRecordRaw) => {
    // 将backstage属性加入meta，标识此路由为后端返回路由（后端返回记录的 meta 由接口保证存在）
    (v.meta as RouteMeta).backstage = true;
    // 父级的redirect属性取值：如果子级存在且父级的redirect属性不存在，默认取第一个子级的path；如果子级存在且父级的redirect属性存在，取存在的redirect属性，会覆盖默认值
    if (v?.children && v.children.length && !v.redirect)
      v.redirect = v.children[0].path;
    // 父级的name属性取值：如果子级存在且父级的name属性不存在，默认取第一个子级的name；如果子级存在且父级的name属性存在，取存在的name属性，会覆盖默认值（注意：测试中发现父级的name不能和子级name重复，如果重复会造成重定向无效（跳转404），所以这里给父级的name起名的时候后面会自动加上`Parent`，避免重复）
    if (v?.children && v.children.length && !v.name) {
      if (isUrl(v.children[0].name as string)) {
        v.name = v.children[0].name as string;
        v.children[0].name = v.name + "Child";
      } else {
        v.name = (v.children[0].name as string) + "Parent";
      }
    }
    if (v.meta?.frameSrc) {
      v.component = IFrame;
    } else {
      // 对后端传component组件路径和不传做兼容（如果后端传component组件路径，那么path可以随便写，如果不传，组件路径会跟path保持一致）
      // 后端下发的 `component` 实际是组件路径字符串，先退化为 `unknown` 再按类型收窄
      const rawComponent = v.component as unknown;
      const target =
        typeof rawComponent === "string" && rawComponent
          ? rawComponent
          : String(v.path ?? "");
      const index = resolveComponentKey(target, modulesRoutesKeys);
      if (index === -1 && import.meta.env.DEV) {
        // 开发态显式报错：component 字符串与 src/views 下文件路径未匹配（运行期表现为空白路由）
        console.error(
          `[xadmin] 动态路由组件未匹配：component=${String(rawComponent ?? "")} path=${String(v.path ?? "")}——` +
            "请确认 src/views 下存在对应页面文件（后端下发的 component 需为文件路径片段）。"
        );
      }
      v.component = modulesRoutes[modulesRoutesKeys[index]];
    }
    if (v?.children && v.children.length) {
      addAsyncRoutes(v.children);
    }
  });
  return arrRoutes;
}

export { addPathMatch, addAsyncRoutes, initRouter };
