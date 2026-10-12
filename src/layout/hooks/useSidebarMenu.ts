import { computed, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { menuType } from "@/layout/types";
import { findRouteByPath, getParentPaths } from "@/router/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";

/**
 * 侧栏菜单数据装配（自 NavVertical 抽出）：
 * - 单列模式：整棵菜单树；双列模式：一级窄列 + 当前一级的子菜单列表；
 * - 一级高亮（窄列）与一级点击跳转；路由/菜单变化时重算子菜单数据。
 */
export function useSidebarMenu(
  submenuSidebar: Ref<boolean>,
  defaultActive: Ref<string>,
  menuSelect: (path: string) => void
) {
  const route = useRoute();
  const router = useRouter();
  const subMenuData = ref<menuType[]>([]);

  const menuData = computed(() =>
    submenuSidebar.value
      ? subMenuData.value
      : usePermissionStoreHook().wholeMenus
  );

  const loading = computed(() =>
    submenuSidebar.value ? false : menuData.value.length === 0
  );

  /** 一级窄列高亮项：当前路由所属的一级路由 */
  const topLevelActive = computed(() => {
    const parents = getParentPaths(
      defaultActive.value,
      usePermissionStoreHook().wholeMenus as never
    );
    return parents[0] ?? defaultActive.value;
  });

  /** 一级窄列点击：跳到该一级路由的首个子路由（与顶栏一级菜单同口径） */
  function handleTopLevelSelect(index: string) {
    const item = usePermissionStoreHook().wholeMenus.find(
      menu => menu.path === index
    );
    if (!item) return;
    const child = item.children?.[0]?.path;
    const httpReg = /^http(s?):\/\//;
    const target = child
      ? httpReg.test(child)
        ? `${item.path}/${child}`
        : child
      : (item.redirect ?? item.path);
    if (typeof target === "string" && target) router.push(target);
  }

  function getSubMenuData() {
    const path = defaultActive.value;
    subMenuData.value = [];
    // path 的上级路由组成的数组
    const parentPathArr = getParentPaths(
      path,
      usePermissionStoreHook().wholeMenus as never
    );
    // 当前路由的父级路由信息
    const parenetRoute = findRouteByPath(
      parentPathArr[0] || path,
      usePermissionStoreHook().wholeMenus as never
    );
    if (!parenetRoute?.children) return;
    // 路由记录与菜单消费类型在类型层不重叠，运行时同源（与 toMenuNode 的边界收窄同口径）
    subMenuData.value = parenetRoute.children as unknown as menuType[];
  }

  watch(
    () => [route.path, usePermissionStoreHook().wholeMenus],
    () => {
      if (route.path.includes("/redirect")) return;
      getSubMenuData();
      menuSelect(route.path);
    }
  );

  return {
    menuData,
    loading,
    topLevelActive,
    handleTopLevelSelect,
    getSubMenuData
  };
}
