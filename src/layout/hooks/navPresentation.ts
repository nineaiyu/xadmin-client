import { computed } from "vue";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import type { menuType } from "@/layout/types";
import { isTwoColumnSidebar } from "./layoutModes";

/**
 * 双列布局的「额外收起」：次级侧栏（双列菜单 / 混合双列的第二列）单独收起，
 * 不影响纵向布局的折叠状态；开关见设置面板 →「布局」→「额外收起」。
 *
 * 纯函数（入参由调用方从响应式存储取值）：会被计算属性在任意上下文求值，
 * 内部不能调用依赖组件实例的 `useGlobal`。
 */
export function mixedExtraCollapsed(
  layout: unknown,
  extraCollapse: unknown
): boolean {
  return isTwoColumnSidebar(layout) && Boolean(extraCollapse);
}

/**
 * 在菜单列表中查找命中激活路径的项（前缀匹配、取最深命中；无命中返回 null）。
 * 用于双列窄列的激活高亮与次级菜单复位。
 */
export function findMenuByActivePath(
  menus: menuType[],
  path: string
): menuType | null {
  let matched: menuType | null = null;
  for (const item of menus) {
    const itemPath = String(item.path ?? "");
    if (itemPath && (path === itemPath || path.startsWith(`${itemPath}/`))) {
      if (!matched || itemPath.length > String(matched.path ?? "").length) {
        matched = item;
      }
    }
  }
  return matched;
}

/**
 * 国际化下拉的选中样式：选中项取 EP 主题色底 + 白字，未选中取常规文本色
 * （暗色下由消费端模板的 `dark:text-white!` 类兜底）。
 */
export function createLocaleDropdownStyles() {
  const getDropdownItemStyle = computed(() => {
    return (locale: string, t: string) => {
      return {
        background: locale === t ? useEpThemeStoreHook().epThemeColor : "",
        color:
          locale === t
            ? "var(--el-color-white)"
            : "var(--el-text-color-primary)"
      };
    };
  });

  const getDropdownItemClass = computed(() => {
    return (locale: string, t: string) => {
      return locale === t ? "" : "dark:hover:text-primary!";
    };
  });

  return { getDropdownItemStyle, getDropdownItemClass };
}
