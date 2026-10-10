import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { routerArrays } from "../types";
import { useGlobal } from "@pureadmin/utils";
import { useMultiTagsStore } from "@/store/modules/multiTags";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import { applyPreferenceAttributes } from "./usePreferenceAttributes";

export function useLayout() {
  const { $storage, $config } = useGlobal<GlobalPropertiesApi>();

  const initStorage = () => {
    /** 路由 */
    if (
      useMultiTagsStore().multiTagsCache &&
      (!$storage.tags || $storage.tags.length === 0)
    ) {
      $storage.tags = routerArrays;
    }
    /** 国际化 */
    if (!$storage.locale) {
      $storage.locale = { locale: $config?.Locale ?? "zh" };
      useI18n().locale.value = $config?.Locale ?? "zh";
    }
    /** 导航 */
    if (!$storage.layout) {
      $storage.layout = {
        layout: $config?.Layout ?? "vertical",
        theme: $config?.Theme ?? "light",
        darkMode: $config?.DarkMode ?? false,
        sidebarStatus: $config?.SidebarStatus ?? true,
        epThemeColor: $config?.EpThemeColor ?? DEFAULT_EP_THEME_COLOR,
        /** 手点主题色（预设名或 custom）：缺省回落导航皮肤名 */
        themeColor: $config?.ThemeColor ?? $config?.Theme ?? "light",
        themeMode: $config?.ThemeMode ?? "light"
      };
    }
    /** 界面显示与交互偏好（缺省值见 public/platform-config.json 与后端 WEB_SITE_CONFIG 种子） */
    if (!$storage.configure) {
      $storage.configure = {
        grey: $config?.Grey ?? false,
        weak: $config?.Weak ?? false,
        hideTabs: $config?.HideTabs ?? false,
        hideFooter: $config.HideFooter ?? true,
        showLogo: $config?.ShowLogo ?? true,
        tagsStyle: $config?.TagsStyle ?? "chrome",
        multiTagsCache: $config?.MultiTagsCache ?? false,
        stretch: $config?.Stretch ?? false,
        headerAutoHide: $config?.HeaderAutoHide ?? false,
        compactMode: $config?.CompactMode ?? false,
        radius: $config?.Radius ?? "default",
        fontScale: $config?.FontScale ?? "default",
        fontScaleCustom: $config?.FontScaleCustom ?? 14,
        sidebarAccordion: $config?.SidebarAccordion ?? true,
        sidebarCollapseButton: $config?.SidebarCollapseButton ?? true,
        semiDarkSidebar: $config?.SemiDarkSidebar ?? false,
        semiDarkHeader: $config?.SemiDarkHeader ?? false,
        sidebarWidth: $config?.SidebarWidth ?? 210,
        sidebarExpandOnHover: $config?.SidebarExpandOnHover ?? true,
        sidebarDraggable: $config?.SidebarDraggable ?? false,
        headerFixed: $config?.HeaderFixed ?? true,
        breadcrumbVisible: $config?.BreadcrumbVisible ?? true,
        breadcrumbShowIcon: $config?.BreadcrumbShowIcon ?? true,
        breadcrumbShowHome: $config?.BreadcrumbShowHome ?? false,
        breadcrumbHideOnlyOne: $config?.BreadcrumbHideOnlyOne ?? false,
        breadcrumbStyle: $config?.BreadcrumbStyle ?? "normal",
        maxTagsCount: $config?.MaxTagsCount ?? 0,
        navbarSearch: $config?.NavbarSearch ?? true,
        navbarLanguage: $config?.NavbarLanguage ?? true,
        navbarFullscreen: $config?.NavbarFullscreen ?? true,
        navbarLock: $config?.NavbarLock ?? true,
        navbarNotice: $config?.NavbarNotice ?? true,
        navbarRefresh: $config?.NavbarRefresh ?? true,
        navbarSidebarToggle: $config?.NavbarSidebarToggle ?? false,
        navbarThemeToggle: $config?.NavbarThemeToggle ?? false,
        tagsMiddleClickClose: $config?.TagsMiddleClickClose ?? true,
        tagsWheelSwitch: $config?.TagsWheelSwitch ?? true,
        tagsShowIcon: $config?.TagsShowIcon ?? true,
        tagsShowRefresh: $config?.TagsShowRefresh ?? true,
        tagsShowMore: $config?.TagsShowMore ?? true,
        dynamicTitle: $config?.DynamicTitle ?? true,
        enablePreferences: $config?.EnablePreferences ?? true,
        preferencesPosition: $config?.PreferencesPosition ?? "header",
        pageTransition: $config?.PageTransition ?? "fade-transform",
        transitionProgress: $config?.TransitionProgress ?? true,
        transitionLoading: $config?.TransitionLoading ?? false,
        shortcutSearch: $config?.ShortcutSearch ?? true,
        shortcutLock: $config?.ShortcutLock ?? true,
        shortcutSidebar: $config?.ShortcutSidebar ?? true,
        shortcutEnable: $config?.ShortcutEnable ?? true,
        shortcutLockKeys: $config?.ShortcutLockKeys ?? "alt+l",
        shortcutSidebarKeys: $config?.ShortcutSidebarKeys ?? "alt+s",
        shortcutSearchKeys: $config?.ShortcutSearchKeys ?? "mod+k",
        shortcutPreferencesKeys: $config?.ShortcutPreferencesKeys ?? "mod+,",
        shortcutLogoutKeys: $config?.ShortcutLogoutKeys ?? ""
      };
    }
    /** 圆角 / 字号档位落到 <html> 属性（登录页等无布局页面同样生效） */
    applyPreferenceAttributes($storage.configure);
  };

  /** 清空缓存后从platform-config.json读取默认配置并赋值到storage中 */
  const layout = computed((): string => {
    return $storage?.layout?.layout ?? "vertical";
  });

  const layoutTheme = computed(() => {
    return $storage.layout;
  });

  return {
    layout,
    layoutTheme,
    initStorage
  };
}
