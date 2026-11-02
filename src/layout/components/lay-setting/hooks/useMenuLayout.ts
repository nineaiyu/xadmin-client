import { useGlobal } from "@pureadmin/utils";
import { useLayout } from "@/layout/hooks/useLayout";
import { resolveLayoutMode } from "@/layout/hooks/layoutModes";
import { useAppStoreHook } from "@/store/modules/app";

/** 导航模式设置：写入响应式 `storage` 的 `layout` 并同步应用状态 */
export function useMenuLayout() {
  const { layoutTheme } = useLayout();
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  /** 设置导航模式 */
  function setMenuLayout(layout: string) {
    layoutTheme.value.layout = layout;
    // CSS 作用域跟随「有效布局」：移动端强制竖排（偏好仍按用户所选持久化，
    // 避免窄屏刷新把 mix / horizontal 永久覆盖成 vertical）
    window.document.body.setAttribute(
      "layout",
      resolveLayoutMode(layout, useAppStoreHook().device === "mobile")
    );
    $storage.layout = {
      layout,
      theme: layoutTheme.value.theme,
      darkMode: $storage.layout?.darkMode,
      sidebarStatus: $storage.layout?.sidebarStatus,
      epThemeColor: $storage.layout?.epThemeColor,
      themeColor: $storage.layout?.themeColor,
      themeMode: $storage.layout?.themeMode
    };
    useAppStoreHook().setLayout(layout);
  }

  return { setMenuLayout };
}
