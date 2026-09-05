import { $t } from "@/plugins/i18n";
import { emitter } from "@/utils/mitt";
import NProgress from "@/utils/progress";
import type { RouteConfigs, tagsViewsType } from "../../../types";
import type { useTags } from "../../../hooks/useTag";
import { routerArrays } from "@/layout/types";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useTagMenuState } from "./useTagMenuState";
import { handleAliveRoute, getTopMenu } from "@/router/utils";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { unref, toRaw, nextTick } from "vue";
import type { Ref } from "vue";

import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import Fullscreen from "~icons/ri/fullscreen-fill";

/** useTags 中标签操作所需的上下文切片 + 滚动 hook 的视口定位回调 */
type TagActionsContext = Pick<
  ReturnType<typeof useTags>,
  | "route"
  | "router"
  | "visible"
  | "multiTags"
  | "tagsViews"
  | "buttonTop"
  | "buttonLeft"
  | "currentSelect"
  | "pureSetting"
  | "closeMenu"
  | "onContentFullScreen"
> & {
  /** 视口定位（useTagScroll），删签/切签后把激活标签滚入可视区 */
  dynamicTagView: () => Promise<void>;
  /** 右键菜单定位基准：tags-view 容器 DOM（模板 ref） */
  containerDom: Ref;
};

/** 标签页增删与右键/下拉菜单逻辑（T2.5 拆分自 lay-tag/index.vue） */
export function useTagActions(ctx: TagActionsContext) {
  const {
    route,
    router,
    visible,
    multiTags,
    tagsViews,
    buttonTop,
    buttonLeft,
    currentSelect,
    pureSetting,
    closeMenu,
    onContentFullScreen,
    dynamicTagView,
    containerDom
  } = ctx;

  const topPath = getTopMenu()?.path;
  const { showMenus, showMenuModel } = useTagMenuState({
    tagsViews,
    multiTags,
    topPath
  });
  const { VITE_HIDE_HOME } = import.meta.env;
  const fixedTags = [
    ...routerArrays,
    ...usePermissionStoreHook().flatteningRoutes.filter(v => v?.meta?.fixedTag)
  ];

  function dynamicRouteTag(value: string): void {
    const hasValue = multiTags.value.some(item => {
      return item.path === value;
    });

    function concatPath(arr: RouteConfigs[], value: string) {
      if (!hasValue) {
        arr.forEach(arrItem => {
          if (arrItem.path === value) {
            useMultiTagsStoreHook().handleTags("push", {
              path: value,
              meta: arrItem.meta,
              name: arrItem.name
            });
          } else {
            if (arrItem.children && arrItem.children.length > 0) {
              concatPath(arrItem.children, value);
            }
          }
        });
      }
    }
    // options.routes 为 readonly 路由树，本项目路由项均符合 RouteConfigs 契约（name 恒为 string）
    concatPath(router.options.routes as RouteConfigs[], value);
  }

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

  function deleteDynamicTag(obj: RouteConfigs, current: string, tag?: string) {
    const valueIndex: number = multiTags.value.findIndex(item => {
      if (item.query) {
        if (item.path === obj.path) {
          return item.query === obj.query;
        }
      } else if (item.params) {
        if (item.path === obj.path) {
          return item.params === obj.params;
        }
      } else {
        return item.path === obj.path;
      }
    });

    const spliceRoute = (
      startIndex?: number,
      length?: number,
      other?: boolean
    ): void => {
      if (other) {
        useMultiTagsStoreHook().handleTags(
          "equal",
          [
            VITE_HIDE_HOME === "false" ? fixedTags : toRaw(getTopMenu()),
            obj
          ].flat()
        );
      } else {
        useMultiTagsStoreHook().handleTags("splice", "", {
          startIndex,
          length
        });
      }
      dynamicTagView();
    };

    if (tag === "other") {
      spliceRoute(1, 1, true);
    } else if (tag === "left") {
      spliceRoute(fixedTags.length, valueIndex - fixedTags.length);
    } else if (tag === "right") {
      spliceRoute(valueIndex + 1, multiTags.value.length);
    } else {
      // 从当前匹配到的路径中删除
      spliceRoute(valueIndex, 1);
    }
    const newRoute = useMultiTagsStoreHook().handleTags("slice");
    if (current === route.path) {
      // 如果删除当前激活tag就自动切换到最后一个tag
      if (tag === "left") return;
      if (newRoute[0]?.query) {
        router.push({ name: newRoute[0].name, query: newRoute[0].query });
      } else if (newRoute[0]?.params) {
        router.push({ name: newRoute[0].name, params: newRoute[0].params });
      } else {
        router.push({ path: newRoute[0].path });
      }
    } else {
      if (!multiTags.value.length) return;
      if (multiTags.value.some(item => item.path === route.path)) return;
      if (newRoute[0]?.query) {
        router.push({ name: newRoute[0].name, query: newRoute[0].query });
      } else if (newRoute[0]?.params) {
        router.push({ name: newRoute[0].name, params: newRoute[0].params });
      } else {
        router.push({ path: newRoute[0].path });
      }
    }
  }

  function deleteMenu(item, tag?: string) {
    deleteDynamicTag(item, item.path, tag);
    handleAliveRoute(route as ToRouteType);
  }

  function onClickDrop(key, item, selectRoute?: RouteConfigs) {
    if (item && item.disabled) return;

    let selectTagRoute;
    if (selectRoute) {
      selectTagRoute = {
        path: selectRoute.path,
        meta: selectRoute.meta,
        name: selectRoute.name,
        query: selectRoute?.query,
        params: selectRoute?.params
      };
    } else {
      selectTagRoute = { path: route.path, meta: route.meta };
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
      case 5:
        // 关闭全部标签页
        useMultiTagsStoreHook().handleTags("splice", "", {
          startIndex: fixedTags.length,
          length: multiTags.value.length
        });
        router.push(topPath);
        // router.push(fixedTags[fixedTags.length - 1]?.path);
        handleAliveRoute(route as ToRouteType);
        break;
      case 6:
        // 内容区全屏
        onContentFullScreen();
        setTimeout(() => {
          if (pureSetting.hiddenSideBar) {
            tagsViews[6].icon = ExitFullscreen;
            tagsViews[6].text = $t("buttons.contentExitFullScreen");
          } else {
            tagsViews[6].icon = Fullscreen;
            tagsViews[6].text = $t("buttons.contentFullScreen");
          }
        }, 100);
        break;
    }
    setTimeout(() => {
      showMenuModel(route.fullPath, route.query, route.params);
    });
  }

  /** el-dropdown 命令载荷：菜单索引 + 菜单项 */
  type TagCommand = {
    key: number;
    item: tagsViewsType;
  };

  function handleCommand(command: TagCommand) {
    const { key, item } = command;
    onClickDrop(key, item);
  }

  /** 触发右键中菜单的点击事件 */
  function selectTag(key, item) {
    closeMenu();
    onClickDrop(key, item, currentSelect.value);
  }

  function openMenu(tag, e) {
    closeMenu();
    if (tag.path === topPath || tag?.meta?.fixedTag) {
      // 右键菜单为顶级菜单或拥有 fixedTag 属性，只显示刷新
      showMenus(false);
      tagsViews[0].show = true;
    } else if (route.path !== tag.path && route.name !== tag.name) {
      // 右键菜单不匹配当前路由，隐藏刷新
      tagsViews[0].show = false;
      showMenuModel(tag.path, tag.query, tag.params);
    } else if (multiTags.value.length === 2 && route.path !== tag.path) {
      showMenus(true);
      // 只有两个标签时不显示关闭其他标签页
      tagsViews[4].show = false;
      showMenuModel(tag.path, tag.query, tag.params);
    } else {
      showMenuModel(tag.path, tag.query, tag.params, true);
    }

    currentSelect.value = tag;
    const menuMinWidth = 140;
    const offsetLeft = unref(containerDom).getBoundingClientRect().left;
    const offsetWidth = unref(containerDom).offsetWidth;
    const maxLeft = offsetWidth - menuMinWidth;
    const left = e.clientX - offsetLeft + 5;
    if (left > maxLeft) {
      buttonLeft.value = maxLeft;
    } else {
      buttonLeft.value = left;
    }
    if (useSettingStoreHook().hiddenSideBar) {
      buttonTop.value = e.clientY;
    } else {
      buttonTop.value = e.clientY - 40;
    }
    nextTick(() => {
      visible.value = true;
    });
  }

  /** 触发tags标签切换 */
  function tagOnClick(item) {
    const { name, path } = item;
    if (name) {
      if (item.query) {
        router.push({
          name,
          query: item.query
        });
      } else if (item.params) {
        router.push({
          name,
          params: item.params
        });
      } else {
        router.push({ name });
      }
    } else {
      router.push({ path });
    }
    emitter.emit("tagOnClick", item);
  }

  return {
    dynamicRouteTag,
    deleteMenu,
    handleCommand,
    selectTag,
    showMenuModel,
    openMenu,
    tagOnClick
  };
}
