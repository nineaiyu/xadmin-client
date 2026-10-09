import { routerArrays } from "@/layout/types";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useTagMenuState } from "./useTagMenuState";
import { useTagDelete } from "./useTagDelete";
import { getTopMenu } from "@/router/utils";
import { createDynamicRouteTag } from "./tagDynamicRoute";
import { createTagDropActions } from "./tagDropActions";
import {
  createTagCommandHandler,
  createTagContextMenu
} from "./tagContextMenu";
import { createTagOnClick } from "./tagNavigate";
import type { TagActionsContext } from "./tagActionTypes";
import type { tagsViewsType } from "../../../types";

export type { TagActionsContext } from "./tagActionTypes";

/**
 * 标签页增删与右键/下拉菜单逻辑：动态标签补开见 tagDynamicRoute.ts，
 * 下拉命令见 tagDropActions.ts，右键菜单见 tagContextMenu.ts，
 * 删除域见 useTagDelete.ts。
 */
export function useTagActions(ctx: TagActionsContext) {
  const {
    route,
    router,
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
  const fixedTags = [
    ...routerArrays,
    ...usePermissionStoreHook().flatteningRoutes.filter(v => v?.meta?.fixedTag)
  ];

  // 标签删除域（左/右/其他/当前裁剪与删除后跳转）见 useTagDelete.ts
  const { deleteMenu } = useTagDelete({
    route,
    router,
    multiTags,
    fixedTags,
    dynamicTagView
  });

  const dynamicRouteTag = createDynamicRouteTag({ multiTags, router });
  const { onClickDrop } = createTagDropActions({
    ctx: {
      route,
      router,
      multiTags,
      tagsViews,
      pureSetting,
      onContentFullScreen
    },
    topPath,
    fixedTags,
    deleteMenu,
    showMenuModel
  });
  const { openMenu, selectTag } = createTagContextMenu({
    ctx: {
      route,
      multiTags,
      tagsViews,
      buttonTop,
      buttonLeft,
      currentSelect,
      visible: ctx.visible,
      closeMenu
    },
    topPath,
    containerDom,
    showMenus,
    showMenuModel,
    onClickDrop
  });
  const handleCommand = createTagCommandHandler(onClickDrop);

  const tagOnClick = createTagOnClick(router);

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

export type { tagsViewsType };
