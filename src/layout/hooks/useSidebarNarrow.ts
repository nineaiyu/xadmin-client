import { computed, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { groupMenuChildren } from "@/utils/menuGroups";
import type { menuType } from "@/layout/types";
import { isHeaderMixedNav, type LayoutMode } from "./layoutModes";
import { findMenuByActivePath } from "./navPresentation";

/**
 * 双列侧栏一级窄列的数据与交互：
 *
 * - 双列菜单：窄列 = 全局一级菜单，主列 = 当前一级的
 *   完整子菜单树（恒定渲染）；
 * - 混合双列：顶栏承担一级导航，窄列 = 当前一级的子菜单，
 *   主列 = 窄列中悬停 / 激活项的 children（无内容时主列整列不渲染，侧栏收为窄列宽度）。
 *
 * 悬停进入窄列项即刷新主列，离开侧栏复位到当前激活链。
 */
export function useSidebarNarrow(
  sidebarMode: Ref<LayoutMode>,
  splitMenus: Ref<menuType[]>,
  defaultActive: Ref<string>,
  topLevelActive: Ref<string>,
  menuData: Ref<menuType[]>
) {
  const router = useRouter();

  /** 混合双列：窄列承担「当前一级的子菜单」（其余双列形态的窄列是全局一级） */
  const narrowSubmenuMode = computed(() => isHeaderMixedNav(sidebarMode.value));

  /** 窄列菜单数据：混合双列为当前一级的子菜单；双列菜单为全局一级菜单 */
  const narrowMenuData = computed<menuType[]>(() =>
    narrowSubmenuMode.value
      ? splitMenus.value
      : usePermissionStoreHook().wholeMenus
  );

  /** 主列（混合双列）的次级菜单：窄列项的子级；悬停 / 路由联动刷新 */
  const extraMenus = ref<menuType[]>([]);
  /**
   * 主列是否存在可见内容：
   * - 双列菜单（`sidebar-mixed-nav`）：主列 = 当前一级的子菜单树。当前一级只有
   *   ≤1 项可展示时不渲染整列、侧栏收为窄列宽度——0 项是叶子菜单
   *   没有内容，1 项则与一级窄列的信息完全重复（如「首页」目录下仅一个首页页）；
   *   菜单尚未装配完成时保守显示，避免首帧整列闪隐；
   * - 混合双列（`header-mixed-nav`）：随窄列悬停 / 激活项的次级菜单显隐。
   */
  const extraVisible = computed(() => {
    if (narrowSubmenuMode.value) return extraMenus.value.length > 0;
    if (usePermissionStoreHook().wholeMenus.length === 0) return true;
    return splitMenus.value.length > 1;
  });

  /** 当前窄列菜单中命中激活路由的项（用于初始化与复位次级菜单） */
  function findActiveNarrowItem(path: string): menuType | null {
    return findMenuByActivePath(narrowMenuData.value, path);
  }

  function updateExtraMenus(item: menuType | null) {
    extraMenus.value = (item?.children ?? []) as menuType[];
  }

  /** 窄列项悬停：刷新主列的次级菜单（仅混合双列；双列菜单的主列恒定） */
  function handleNarrowMouseEnter(item: menuType) {
    if (!narrowSubmenuMode.value) return;
    updateExtraMenus(item);
  }

  /** 离开侧栏：次级菜单复位到当前激活链（避免停留在悬停项上） */
  function handleNarrowMouseLeave() {
    if (!narrowSubmenuMode.value) return;
    updateExtraMenus(findActiveNarrowItem(defaultActive.value));
  }

  /** 窄列激活项：混合双列取当前二级（defaultActive 命中项）；双列菜单取当前一级 */
  const narrowActive = computed(() =>
    narrowSubmenuMode.value
      ? (findActiveNarrowItem(defaultActive.value)?.path ?? "")
      : topLevelActive.value
  );

  /** 窄列点击：双列菜单跳一级首个子路由；混合双列的窄列项即二级菜单，直达（优先首个子级） */
  function handleNarrowSelect(index: string) {
    const item = narrowMenuData.value.find(menu => menu.path === index);
    if (!item) return;
    const child = item.children?.[0]?.path;
    const target = child ?? item.redirect ?? item.path;
    if (typeof target === "string" && target) router.push(target);
  }

  /** 主列渲染序列：支持一级菜单按 groupName/groupRank 分组（仅影响展示层）；
      混合双列的主列数据来自窄列联动（extraMenus），其余布局取菜单装配结果 */
  const topMenuData = computed(() =>
    groupMenuChildren(
      (narrowSubmenuMode.value ? extraMenus.value : menuData.value) as never
    )
  );

  /** 路由 / 布局变化：次级菜单复位到当前激活链（混合双列） */
  watch(
    [defaultActive, narrowSubmenuMode],
    () => {
      if (!narrowSubmenuMode.value) return;
      updateExtraMenus(findActiveNarrowItem(defaultActive.value));
    },
    { immediate: true }
  );

  return {
    narrowSubmenuMode,
    narrowMenuData,
    extraVisible,
    narrowActive,
    handleNarrowMouseEnter,
    handleNarrowMouseLeave,
    handleNarrowSelect,
    topMenuData
  };
}
