// 响应式storage
import type { App } from "vue";
import Storage from "responsive-storage";
import { routerArrays } from "@/layout/types";
import { responsiveStorageNameSpace } from "@/config";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";

export const injectResponsiveStorage = (app: App, config: PlatformConfigs) => {
  const nameSpace = responsiveStorageNameSpace();
  const configObj = Object.assign(
    {
      // 国际化 默认中文zh
      locale: {
        locale: config.Locale ?? "zh"
      },
      // layout模式以及主题
      layout: {
        layout: config.Layout ?? "vertical",
        theme: config.Theme ?? "light",
        darkMode: config.DarkMode ?? false,
        sidebarStatus: config.SidebarStatus ?? true,
        epThemeColor: config.EpThemeColor ?? DEFAULT_EP_THEME_COLOR,
        // 主题色（手点主题色，预设名或 custom）：与 theme（导航皮肤）分离持久化，
        // 缺省回落 Theme，保证历史数据与未改动状态取值不变
        themeColor: config.ThemeColor ?? config.Theme ?? "light",
        themeMode: config.ThemeMode ?? "light" // 整体风格（浅色：light、深色：dark、自动：system）
      },
      // 项目配置-界面显示：新增键必须同步登记（platform-config.json、本文件、
      // useLayout.initStorage、siteConfig 读/写、后端 WEB_SITE_CONFIG 种子 + 类型）
      configure: {
        grey: config.Grey ?? false,
        weak: config.Weak ?? false,
        hideTabs: config.HideTabs ?? false,
        hideFooter: config.HideFooter ?? true,
        footerFixed: config.FooterFixed ?? false,
        footerHeight: config.FooterHeight ?? 0,
        showLogo: config.ShowLogo ?? true,
        logoSource: config.LogoSource ?? "",
        logoShowText: config.LogoShowText ?? true,
        logoFit: config.LogoFit ?? "contain",
        tagsStyle: config.TagsStyle ?? "chrome",
        multiTagsCache: config.MultiTagsCache ?? false,
        stretch: config.Stretch ?? false,
        headerAutoHide: config.HeaderAutoHide ?? false,
        compactMode: config.CompactMode ?? false,
        radius: config.Radius ?? "default",
        fontScale: config.FontScale ?? "default",
        fontScaleCustom: config.FontScaleCustom ?? 14,
        themePreset: config.ThemePreset ?? "default",
        navigationStyle: config.NavigationStyle ?? "rounded",
        sidebarAccordion: config.SidebarAccordion ?? true,
        sidebarCollapseButton: config.SidebarCollapseButton ?? true,
        semiDarkSidebar: config.SemiDarkSidebar ?? false,
        semiDarkHeader: config.SemiDarkHeader ?? false,
        semiDarkSidebarSub: config.SemiDarkSidebarSub ?? false,
        successColor: config.SuccessColor ?? "",
        warningColor: config.WarningColor ?? "",
        dangerColor: config.DangerColor ?? "",
        sidebarWidth: config.SidebarWidth ?? 210,
        sidebarExpandOnHover: config.SidebarExpandOnHover ?? true,
        sidebarDraggable: config.SidebarDraggable ?? false,
        sidebarCollapsedShowTitle: config.SidebarCollapsedShowTitle ?? false,
        sidebarAutoActivateChild: config.SidebarAutoActivateChild ?? false,
        headerFixed: config.HeaderFixed ?? true,
        breadcrumbVisible: config.BreadcrumbVisible ?? true,
        breadcrumbShowIcon: config.BreadcrumbShowIcon ?? true,
        breadcrumbShowHome: config.BreadcrumbShowHome ?? false,
        breadcrumbHideOnlyOne: config.BreadcrumbHideOnlyOne ?? false,
        breadcrumbStyle: config.BreadcrumbStyle ?? "normal",
        maxTagsCount: config.MaxTagsCount ?? 0,
        navbarSearch: config.NavbarSearch ?? true,
        navbarLanguage: config.NavbarLanguage ?? true,
        navbarFullscreen: config.NavbarFullscreen ?? true,
        navbarLock: config.NavbarLock ?? true,
        navbarNotice: config.NavbarNotice ?? true,
        navbarRefresh: config.NavbarRefresh ?? true,
        navbarSidebarToggle: config.NavbarSidebarToggle ?? false,
        navbarThemeToggle: config.NavbarThemeToggle ?? false,
        navbarOrder: config.NavbarOrder ?? [],
        navbarMoreWidgets: config.NavbarMoreWidgets ?? [],
        headerMenuAlign: config.HeaderMenuAlign ?? "start",
        sidebarCollapseWidth: config.SidebarCollapseWidth ?? 54,
        sidebarMixedWidth: config.SidebarMixedWidth ?? 0,
        sidebarHidden: config.SidebarHidden ?? false,
        sidebarFixedButton: config.SidebarFixedButton ?? false,
        sidebarExtraCollapse: config.SidebarExtraCollapse ?? false,
        tagsMiddleClickClose: config.TagsMiddleClickClose ?? true,
        tagsWheelSwitch: config.TagsWheelSwitch ?? true,
        tagsShowIcon: config.TagsShowIcon ?? true,
        tagsShowRefresh: config.TagsShowRefresh ?? true,
        tagsShowMore: config.TagsShowMore ?? true,
        tagsHeight: config.TagsHeight ?? 34,
        tagsKeepAlive: config.TagsKeepAlive ?? true,
        tagsVisitHistory: config.TagsVisitHistory ?? true,
        dynamicTitle: config.DynamicTitle ?? true,
        enablePreferences: config.EnablePreferences ?? true,
        preferencesPosition: config.PreferencesPosition ?? "header",
        pageTransition: config.PageTransition ?? "fade-transform",
        transitionProgress: config.TransitionProgress ?? true,
        transitionLoading: config.TransitionLoading ?? false,
        shortcutSearch: config.ShortcutSearch ?? true,
        shortcutLock: config.ShortcutLock ?? true,
        shortcutSidebar: config.ShortcutSidebar ?? true,
        shortcutEnable: config.ShortcutEnable ?? true,
        shortcutLockKeys: config.ShortcutLockKeys ?? "alt+l",
        shortcutSidebarKeys: config.ShortcutSidebarKeys ?? "alt+s",
        shortcutSearchKeys: config.ShortcutSearchKeys ?? "mod+k",
        shortcutPreferencesKeys: config.ShortcutPreferencesKeys ?? "mod+,",
        shortcutLogoutKeys: config.ShortcutLogoutKeys ?? ""
      }
    },
    config.MultiTagsCache
      ? {
          // 默认显示顶级菜单tag
          tags: Storage.getData("tags", nameSpace) ?? routerArrays
        }
      : {}
  );

  app.use(Storage, { nameSpace, memory: configObj });
};
