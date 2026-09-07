import { isEqual, isAllEmpty } from "@pureadmin/utils";
import type { useTags } from "../../../hooks/useTag";

/** useTags 中菜单可见性状态所需的上下文切片 */
type TagMenuStateContext = Pick<
  ReturnType<typeof useTags>,
  "tagsViews" | "multiTags"
> & {
  /** 顶级菜单路径（/redirect 前缀判断用） */
  topPath: string | undefined;
};

/** 右键/下拉菜单的显示与禁用状态机（拆分自 lay-tag/index.vue） */
export function useTagMenuState(ctx: TagMenuStateContext) {
  const { tagsViews, multiTags, topPath } = ctx;

  function showMenus(value: boolean) {
    Array.of(1, 2, 3, 4, 5).forEach(v => {
      tagsViews[v].show = value;
    });
  }

  function disabledMenus(value: boolean, fixedTag = false) {
    Array.of(1, 2, 3, 4, 5).forEach(v => {
      tagsViews[v].disabled = value;
    });
    if (fixedTag) {
      tagsViews[2].show = false;
      tagsViews[2].disabled = true;
    }
  }

  /** 检查当前右键的菜单两边是否存在别的菜单，如果左侧的菜单是顶级菜单，则不显示关闭左侧标签页，如果右侧没有菜单，则不显示关闭右侧标签页 */
  function showMenuModel(
    currentPath: string,
    query: object = {},
    params: object = {},
    refresh = false
  ) {
    const allRoute = multiTags.value;
    const routeLength = multiTags.value.length;
    let currentIndex = -1;
    if (!isAllEmpty(params)) {
      currentIndex = allRoute.findIndex(v => isEqual(v.params, params));
    } else if (!isAllEmpty(query)) {
      currentIndex = allRoute.findIndex(v => isEqual(v.query, query));
    } else {
      currentIndex = allRoute.findIndex(v => v.path === currentPath);
    }
    function fixedTagDisabled() {
      if (allRoute[currentIndex]?.meta?.fixedTag) {
        Array.of(1, 2, 3, 4, 5).forEach(v => {
          tagsViews[v].disabled = true;
        });
      }
    }

    showMenus(true);

    if (refresh) {
      tagsViews[0].show = true;
    }

    /**
     * currentIndex为1时，左侧的菜单顶级菜单，则不显示关闭左侧标签页
     * 如果currentIndex等于routeLength-1，右侧没有菜单，则不显示关闭右侧标签页
     */
    if (currentIndex === 1 && routeLength !== 2) {
      // 左侧的菜单是顶级菜单，右侧存在别的菜单
      tagsViews[2].show = false;
      Array.of(1, 3, 4, 5).forEach(v => {
        tagsViews[v].disabled = false;
      });
      tagsViews[2].disabled = true;
      fixedTagDisabled();
    } else if (currentIndex === 1 && routeLength === 2) {
      disabledMenus(false);
      // 左侧的菜单是顶级菜单，右侧不存在别的菜单
      Array.of(2, 3, 4).forEach(v => {
        tagsViews[v].show = false;
        tagsViews[v].disabled = true;
      });
      fixedTagDisabled();
    } else if (routeLength - 1 === currentIndex && currentIndex !== 0) {
      // 当前路由是所有路由中的最后一个
      tagsViews[3].show = false;
      Array.of(1, 2, 4, 5).forEach(v => {
        tagsViews[v].disabled = false;
      });
      tagsViews[3].disabled = true;
      if (allRoute[currentIndex - 1]?.meta?.fixedTag) {
        tagsViews[2].show = false;
        tagsViews[2].disabled = true;
      }
      fixedTagDisabled();
    } else if (currentIndex === 0 || currentPath === `/redirect${topPath}`) {
      // 当前路由为顶级菜单
      disabledMenus(true);
    } else {
      disabledMenus(false, allRoute[currentIndex - 1]?.meta?.fixedTag);
      fixedTagDisabled();
    }
  }

  return { showMenus, disabledMenus, showMenuModel };
}
