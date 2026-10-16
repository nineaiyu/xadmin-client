import { useGlobal } from "@pureadmin/utils";
import { useLayout } from "@/layout/hooks/useLayout";
import { useAppStoreHook } from "@/store/modules/app";

/** 导航模式设置：写入响应式 `storage` 的 `layout` 并同步应用状态 */
export function useMenuLayout() {
  const { layoutTheme } = useLayout();
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  /** 设置导航模式 */
  function setMenuLayout(layout: string) {
    layoutTheme.value.layout = layout;
    window.document.body.setAttribute("layout", layout);
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
