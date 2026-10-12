import { computed, type Ref } from "vue";
import { useRoute } from "vue-router";
import { isAllEmpty, useGlobal } from "@pureadmin/utils";
import type { menuType } from "@/layout/types";
import { findRouteByPath, getParentPaths } from "@/router/utils";
import { useAppStoreHook } from "@/store/modules/app";
import { usePermissionStoreHook } from "@/store/modules/permission";
import {
  hasSidebar,
  isHeaderMixedNav,
  isMixedNav,
  resolveLayoutMode,
  sidebarShowsSubmenu
} from "./layoutModes";

/**
 * 「导航切割」侧栏状态（混合 / 双列布局）：一级导航在顶栏或一级窄列，侧栏只承担
 * 当前一级路由的子菜单。菜单数据与侧栏可见性共用同一口径，避免多处各算一套。
 *
 * 关键边界：当前一级是叶子菜单（如「首页」）时没有子菜单可展示——此时侧栏整块
 * 不渲染（与 vben 的 `sidebarVisible = splitSideMenus.length > 0` 同口径），否则
 * 顶栏下方会留一条空白侧栏。
 */
export function useSplitSidebar(defaultActive?: Ref<string>) {
  const route = useRoute();
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  /** 侧栏语义模式（移动端强制回落竖排） */
  const sidebarMode = computed(() =>
    resolveLayoutMode(
      $storage?.layout?.layout,
      useAppStoreHook().device === "mobile"
    )
  );

  /** 是否处于切割形态（侧栏显示子菜单） */
  const splitActive = computed(() =>
    sidebarShowsSubmenu(sidebarMode.value, $storage?.configure?.navigationSplit)
  );

  /** 菜单数据源路径：优先调用方传入的高亮路径，其次路由 activePath，最后当前路径 */
  const activePath = computed(() => {
    if (defaultActive?.value) return defaultActive.value;
    return !isAllEmpty(route.meta?.activePath)
      ? String(route.meta.activePath)
      : route.path;
  });

  /** 侧栏菜单列表：切割形态为当前一级的子菜单，整树形态为空（消费侧自行取整树） */
  const splitMenus = computed<menuType[]>(() => {
    if (!splitActive.value) return [];
    const wholeMenus = usePermissionStoreHook().wholeMenus;
    if (wholeMenus.length === 0) return [];
    const parents = getParentPaths(activePath.value, wholeMenus as never);
    const parentRoute = findRouteByPath(
      parents[0] || activePath.value,
      wholeMenus as never
    );
    return (parentRoute?.children ?? []) as unknown as menuType[];
  });

  /**
   * 切割形态下侧栏是否因无内容而整体隐藏（对齐 vben `sidebarVisible`）：仅
   * 「顶栏承担一级导航」的两种布局（混合 / 混合双列）在当前一级没有子菜单时
   * 隐藏——此时顶栏仍有完整一级菜单可导航；双列菜单（一级窄列）不参与该判定，
   * 否则会把唯一的一级导航一起隐藏掉。
   */
  const hiddenByEmptySplit = computed(() => {
    const mode = sidebarMode.value;
    const governs =
      (isMixedNav(mode) && ($storage?.configure?.navigationSplit ?? true)) ||
      isHeaderMixedNav(mode);
    return governs && splitMenus.value.length === 0;
  });

  /** 布局层面是否渲染侧栏（水平布局与全屏内容不渲染） */
  const sidebarEnabled = computed(() => hasSidebar(sidebarMode.value));

  return {
    sidebarMode,
    splitActive,
    splitMenus,
    hiddenByEmptySplit,
    sidebarEnabled
  };
}
