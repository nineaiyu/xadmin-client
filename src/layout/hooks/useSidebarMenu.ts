import { computed, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getParentPaths } from "@/router/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useSplitSidebar } from "./useSplitSidebar";

/**
 * 侧栏菜单数据装配：
 * - 整树模式：整棵菜单树；
 * - 切割形态（混合 / 双列）：当前一级的子菜单列表（口径见 useSplitSidebar）。
 * 另含一级窄列高亮与「路由变化 → 菜单选中态」联动。
 */
export function useSidebarMenu(
  submenuSidebar: Ref<boolean>,
  defaultActive: Ref<string>,
  menuSelect: (path: string) => void
) {
  const route = useRoute();
  const router = useRouter();
  const { splitMenus } = useSplitSidebar(defaultActive);

  const menuData = computed(() =>
    submenuSidebar.value
      ? splitMenus.value
      : usePermissionStoreHook().wholeMenus
  );

  // 空菜单 ≠ 装配中：零菜单权限账号在 handleWholeMenus 之后应得到空态，
  // 而不是永久 loading（历史实现只以长度判定，空结果与未装配不可区分）
  const loading = computed(() =>
    submenuSidebar.value
      ? false
      : !usePermissionStoreHook().menusLoaded && menuData.value.length === 0
  );

  const empty = computed(() => !loading.value && menuData.value.length === 0);

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

  watch(
    () => [route.path, usePermissionStoreHook().wholeMenus],
    () => {
      if (route.path.includes("/redirect")) return;
      menuSelect(route.path);
    }
  );

  return {
    menuData,
    loading,
    empty,
    topLevelActive,
    handleTopLevelSelect
  };
}
