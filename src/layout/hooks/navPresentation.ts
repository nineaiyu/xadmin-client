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
 * 在菜单列表中查找命中激活路径的项（供双列窄列的激活高亮与次级菜单复位）。
 *
 * 层级判定以菜单树的 `children` 关系为准，而不是 URL 前缀：
 * 目录路径与页面路径不保证同前缀（如「日志管理」目录 `/system/logs` 下挂着
 * `/system/online/index`、`/system/account-risk/index`）。按前缀推断会把这类页面
 * 判成「不属于任何窄列项」，点击后次级列被当成空列收起。
 * 仅当菜单树中找不到时才回落到前缀匹配（兼容 activePath 指向树外页面）。
 */
export function findMenuByActivePath(
  menus: menuType[],
  path: string
): menuType | null {
  if (!path) return null;
  for (const item of menus) {
    if (String(item.path ?? "") === path || containsMenuPath(item, path)) {
      return item;
    }
  }
  return findMenuByPathPrefix(menus, path);
}

/** 菜单项的任意后代是否命中路径 */
function containsMenuPath(item: menuType, path: string): boolean {
  return (item.children ?? []).some(
    child => String(child.path ?? "") === path || containsMenuPath(child, path)
  );
}

/** 兜底：路径前缀匹配、取最深命中（历史口径，仅在菜单树未命中时使用） */
function findMenuByPathPrefix(
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
 * （暗色下由消费端模板的 `dark:text-(--el-color-white)!` 类兜底）。
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
