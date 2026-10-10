import { $t } from "@/plugins/i18n";
import NProgress from "@/utils/progress";
import { unref } from "vue";
import { handleAliveRoute } from "@/router/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import Fullscreen from "~icons/ri/fullscreen-fill";
import type { RouteConfigs, tagsViewsType } from "../../../types";
import type { menuType } from "@/layout/types";
import type { LocationQueryRaw, RouteParamsRaw } from "vue-router";
import type { useTags } from "../../../hooks/useTag";

type TagContext = Pick<
  ReturnType<typeof useTags>,
  | "route"
  | "router"
  | "multiTags"
  | "tagsViews"
  | "pureSetting"
  | "onContentFullScreen"
>;

/**
 * 标签下拉菜单命令（自 useTagActions.ts 抽出）：刷新 / 关闭当前·左侧·右侧·
 * 其他·全部 / 内容区全屏，命令回调统一在末尾重算菜单显隐。
 */
export function createTagDropActions({
  ctx,
  topPath,
  fixedTags,
  deleteMenu,
  showMenuModel
}: {
  ctx: TagContext;
  topPath?: string;
  fixedTags: unknown[];
  deleteMenu: (tag: menuType, mode?: "left" | "right" | "other") => void;
  showMenuModel: (
    path: string,
    query?: LocationQueryRaw,
    params?: RouteParamsRaw,
    showAll?: boolean
  ) => void;
}) {
  const {
    route,
    router,
    multiTags,
    tagsViews,
    pureSetting,
    onContentFullScreen
  } = ctx;

  /** 刷新路由 */
  function onFresh() {
    NProgress.start();
    const { fullPath, query } = unref(route);
    router.replace({
      path: "/redirect" + fullPath,
      query
    });
    handleAliveRoute(route as ToRouteType, "refresh");
    NProgress.done();
  }

  /** 新窗口打开标签：hash 路由以当前页面地址为基底拼接（含查询串） */
  function openInNewWindow(selectTagRoute: menuType) {
    const query = (selectTagRoute.query ?? {}) as Record<string, unknown>;
    const search = Object.keys(query).length
      ? `?${new URLSearchParams(
          Object.entries(query).map(([key, value]) => [key, String(value)])
        ).toString()}`
      : "";
    window.open(
      `${window.location.origin}${window.location.pathname}#${selectTagRoute.path}${search}`,
      "_blank",
      "noopener"
    );
  }

  function onClickDrop(
    key: number,
    item: { disabled?: boolean },
    selectRoute?: RouteConfigs
  ) {
    if (item && item.disabled) return;

    let selectTagRoute: menuType;
    if (selectRoute) {
      selectTagRoute = {
        path: selectRoute.path,
        value: undefined,
        meta: selectRoute.meta as menuType["meta"],
        name: selectRoute.name as string,
        query: selectRoute?.query as LocationQueryRaw,
        params: selectRoute?.params as RouteParamsRaw
      };
    } else {
      selectTagRoute = {
        path: route.path,
        value: undefined,
        meta: route.meta as menuType["meta"]
      };
    }

    // 当前路由信息
    switch (key) {
      case 0:
        // 刷新路由
        onFresh();
        break;
      case 1:
        // 关闭当前标签页
        deleteMenu(selectTagRoute);
        break;
      case 2:
        // 关闭左侧标签页
        deleteMenu(selectTagRoute, "left");
        break;
      case 3:
        // 关闭右侧标签页
        deleteMenu(selectTagRoute, "right");
        break;
      case 4:
        // 关闭其他标签页
        deleteMenu(selectTagRoute, "other");
        break;
      case 5: {
        // 关闭全部标签页：保留固定标签（路由级 fixedTag + 右键固定的标签）
        const keep = new Set<string | undefined>(
          (fixedTags as { path?: string }[]).map(tag => tag.path)
        );
        multiTags.value
          .filter(tag => useMultiTagsStoreHook().isPinnedTag(tag.path ?? ""))
          .forEach(tag => keep.add(tag.path));
        useMultiTagsStoreHook().handleTags(
          "equal",
          multiTags.value.filter(tag => keep.has(tag.path))
        );
        router.push(topPath ?? "/");
        handleAliveRoute(route as ToRouteType);
        break;
      }
      case 6:
        // 内容区最大化 / 还原（隐藏顶栏与侧边栏，页签条保留作为还原入口）
        onContentFullScreen();
        setTimeout(() => {
          if (pureSetting.hiddenSideBar) {
            tagsViews[6].icon = ExitFullscreen;
            tagsViews[6].text = $t("buttons.restoreMaximize");
          } else {
            tagsViews[6].icon = Fullscreen;
            tagsViews[6].text = $t("buttons.maximize");
          }
        }, 100);
        break;
      case 7: {
        // 固定 / 取消固定标签（固定标签不参与按侧/全部关闭）
        // 路由级 fixedTag（首页等）本就不可关闭，固定无意义：下拉菜单不按 show 过滤，
        // 这里直接忽略，避免把冗余项写进本地固定清单
        if (selectTagRoute.meta?.fixedTag) break;
        useMultiTagsStoreHook().togglePinnedTag(selectTagRoute.path ?? "");
        break;
      }
      case 8:
        // 新窗口打开
        openInNewWindow(selectTagRoute);
        break;
    }
    setTimeout(() => {
      showMenuModel(route.fullPath, route.query, route.params);
    });
  }

  return { onClickDrop };
}

/** el-dropdown 命令载荷：菜单索引 + 菜单项 */
export type TagCommand = {
  key: number;
  item: tagsViewsType;
};
