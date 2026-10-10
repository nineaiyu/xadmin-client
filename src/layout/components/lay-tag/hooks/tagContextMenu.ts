import { unref, nextTick } from "vue";
import { useSettingStoreHook } from "@/store/modules/settings";
import type { RouteConfigs, tagsViewsType } from "../../../types";
import type { useTags } from "../../../hooks/useTag";
import type { Ref } from "vue";

type TagContext = Pick<
  ReturnType<typeof useTags>,
  | "route"
  | "multiTags"
  | "tagsViews"
  | "buttonTop"
  | "buttonLeft"
  | "currentSelect"
  | "visible"
  | "closeMenu"
>;

/** 右键菜单的最小宽度（超出容器右边界时贴边显示） */
const MENU_MIN_WIDTH = 140;

/**
 * 标签右键菜单（自 useTagActions.ts 抽出）：菜单项显隐、定位与打开时的
 * 路由上下文重置。
 */
export function createTagContextMenu({
  ctx,
  topPath,
  containerDom,
  showMenus,
  showMenuModel,
  onClickDrop
}: {
  ctx: TagContext;
  topPath?: string;
  /** 右键菜单定位基准：tags-view 容器 DOM（模板 ref） */
  containerDom: Ref;
  showMenus: (show: boolean) => void;
  showMenuModel: (
    path: string,
    query?: Record<string, unknown>,
    params?: Record<string, unknown>,
    showAll?: boolean
  ) => void;
  onClickDrop: (
    key: number,
    item: { disabled?: boolean },
    selectRoute?: RouteConfigs
  ) => void;
}) {
  const {
    route,
    multiTags,
    tagsViews,
    buttonTop,
    buttonLeft,
    currentSelect,
    visible,
    closeMenu
  } = ctx;

  /** 触发右键中菜单的点击事件 */
  function selectTag(key: number, item: { disabled?: boolean }) {
    closeMenu();
    onClickDrop(key, item, currentSelect.value as RouteConfigs);
  }

  function openMenu(tag: RouteConfigs, e: MouseEvent) {
    closeMenu();
    if (tag.path === topPath || tag?.meta?.fixedTag) {
      // 右键菜单为顶级菜单或拥有 fixedTag 属性，只显示刷新（固定项对已固定标签无意义）
      showMenus(false);
      tagsViews[0].show = true;
      tagsViews[7].show = false;
    } else if (route.path !== tag.path && route.name !== tag.name) {
      // 右键菜单不匹配当前路由，隐藏刷新
      tagsViews[0].show = false;
      showMenuModel(tag.path ?? "", tag.query, tag.params);
    } else if (multiTags.value.length === 2 && route.path !== tag.path) {
      showMenus(true);
      // 只有两个标签时不显示关闭其他标签页
      tagsViews[4].show = false;
      showMenuModel(tag.path ?? "", tag.query, tag.params);
    } else {
      showMenuModel(tag.path ?? "", tag.query, tag.params, true);
    }

    currentSelect.value = tag;
    const offsetLeft = unref(containerDom).getBoundingClientRect().left;
    const offsetWidth = unref(containerDom).offsetWidth;
    const maxLeft = offsetWidth - MENU_MIN_WIDTH;
    const left = e.clientX - offsetLeft + 5;
    buttonLeft.value = left > maxLeft ? maxLeft : left;
    if (useSettingStoreHook().hiddenSideBar) {
      buttonTop.value = e.clientY;
    } else {
      buttonTop.value = e.clientY - 40;
    }
    nextTick(() => {
      visible.value = true;
    });
  }

  return { openMenu, selectTag };
}

/** el-dropdown 命令载荷处理：菜单索引 + 菜单项 */
export function createTagCommandHandler(
  onClickDrop: (
    key: number,
    item: { disabled?: boolean },
    selectRoute?: RouteConfigs
  ) => void
) {
  return function handleCommand(command: { key: number; item: tagsViewsType }) {
    const { key, item } = command;
    onClickDrop(key, item);
  };
}
