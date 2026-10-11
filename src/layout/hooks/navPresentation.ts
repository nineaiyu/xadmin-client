import { computed } from "vue";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";

/**
 * 混合布局的「额外收起」：第二列侧栏（混合布局的侧栏）单独收起，
 * 不影响纵向布局的折叠状态；开关见设置面板 →「布局」→「额外收起」。
 *
 * 纯函数（入参由调用方从响应式存储取值）：会被计算属性在任意上下文求值，
 * 内部不能调用依赖组件实例的 `useGlobal`。
 */
export function mixedExtraCollapsed(
  layout: unknown,
  extraCollapse: unknown
): boolean {
  return String(layout ?? "vertical").includes("mix") && Boolean(extraCollapse);
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
