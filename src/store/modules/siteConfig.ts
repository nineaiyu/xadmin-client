import { defineStore } from "pinia";
import { setConfig } from "@/config";
import Storage from "responsive-storage";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { cloneDeep } from "@pureadmin/utils";
import { responsiveStorageNameSpace, store } from "../utils";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";

// 站点配置接口在动作内动态引入：顶层静态边 store/siteConfig → api/config
// 会经 api/base → utils/http → store 成环（环检测脚本守护）。

/** 设置项变更后的自动保存防抖窗口（合并设置面板里的连续操作） */
const AUTO_SAVE_DEBOUNCE_MS = 600;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSiteConfigStore = defineStore("pure-site-config", {
  state: () => ({
    config: {},
    nameSpace: responsiveStorageNameSpace()
  }),
  actions: {
    setSiteConfig(config: PlatformConfigs) {
      Object.entries(config).forEach(([key, value]) => {
        Storage.set(`${this.nameSpace}${key}`, value);
      });
    },
    async resetSiteConfig() {
      const { configApi } = await import("@/api/config");
      configApi.resetSiteConfig().then(() => {
        message(transformI18n("layout.resetConfigSuccess"), {
          type: "success"
        });
        window.location.reload();
      });
    },
    /**
     * 保存站点配置（整包 PATCH，后端按键 merge）。
     * @param silent 自动保存场景传 true：成功不弹提示，避免每次设置变更刷屏
     */
    async saveSiteConfig(silent = false) {
      const { configApi } = await import("@/api/config");
      return new Promise((resolve, reject) => {
        const locale = Storage.getData("locale", this.nameSpace);
        const layout = Storage.getData("layout", this.nameSpace);
        const configure = Storage.getData("configure", this.nameSpace);
        const configObj = {
          Locale: locale.locale,
          Layout: layout.layout,
          Theme: layout.theme,
          ThemeColor: layout.themeColor,
          DarkMode: layout.darkMode,
          SidebarStatus: layout.sidebarStatus,
          EpThemeColor: layout.epThemeColor,
          ThemeMode: layout.themeMode,
          Grey: configure.grey,
          Weak: configure.weak,
          HideTabs: configure.hideTabs,
          HideFooter: configure.hideFooter,
          FooterFixed: configure.footerFixed,
          FooterHeight: configure.footerHeight,
          ShowLogo: configure.showLogo,
          LogoSource: configure.logoSource,
          LogoShowText: configure.logoShowText,
          LogoFit: configure.logoFit,
          TagsStyle: configure.tagsStyle,
          MultiTagsCache: configure.multiTagsCache,
          Stretch: configure.stretch,
          HeaderAutoHide: configure.headerAutoHide,
          CompactMode: configure.compactMode,
          Radius: configure.radius,
          FontScale: configure.fontScale,
          FontScaleCustom: configure.fontScaleCustom,
          ThemePreset: configure.themePreset,
          NavigationStyle: configure.navigationStyle,
          SidebarAccordion: configure.sidebarAccordion,
          SidebarCollapseButton: configure.sidebarCollapseButton,
          SemiDarkSidebar: configure.semiDarkSidebar,
          SemiDarkHeader: configure.semiDarkHeader,
          SemiDarkSidebarSub: configure.semiDarkSidebarSub,
          SuccessColor: configure.successColor,
          WarningColor: configure.warningColor,
          DangerColor: configure.dangerColor,
          SidebarWidth: configure.sidebarWidth,
          SidebarExpandOnHover: configure.sidebarExpandOnHover,
          SidebarDraggable: configure.sidebarDraggable,
          SidebarCollapsedShowTitle: configure.sidebarCollapsedShowTitle,
          SidebarAutoActivateChild: configure.sidebarAutoActivateChild,
          HeaderFixed: configure.headerFixed,
          BreadcrumbVisible: configure.breadcrumbVisible,
          BreadcrumbShowIcon: configure.breadcrumbShowIcon,
          BreadcrumbShowHome: configure.breadcrumbShowHome,
          BreadcrumbHideOnlyOne: configure.breadcrumbHideOnlyOne,
          BreadcrumbStyle: configure.breadcrumbStyle,
          MaxTagsCount: configure.maxTagsCount,
          NavbarSearch: configure.navbarSearch,
          NavbarLanguage: configure.navbarLanguage,
          NavbarFullscreen: configure.navbarFullscreen,
          NavbarLock: configure.navbarLock,
          NavbarNotice: configure.navbarNotice,
          NavbarRefresh: configure.navbarRefresh,
          NavbarSidebarToggle: configure.navbarSidebarToggle,
          NavbarThemeToggle: configure.navbarThemeToggle,
          NavbarOrder: configure.navbarOrder,
          NavbarMoreWidgets: configure.navbarMoreWidgets,
          HeaderMenuAlign: configure.headerMenuAlign,
          SidebarCollapseWidth: configure.sidebarCollapseWidth,
          SidebarMixedWidth: configure.sidebarMixedWidth,
          SidebarHidden: configure.sidebarHidden,
          SidebarFixedButton: configure.sidebarFixedButton,
          SidebarExtraCollapse: configure.sidebarExtraCollapse,
          TagsMiddleClickClose: configure.tagsMiddleClickClose,
          TagsWheelSwitch: configure.tagsWheelSwitch,
          TagsShowIcon: configure.tagsShowIcon,
          TagsShowRefresh: configure.tagsShowRefresh,
          TagsShowMore: configure.tagsShowMore,
          TagsHeight: configure.tagsHeight,
          TagsKeepAlive: configure.tagsKeepAlive,
          TagsVisitHistory: configure.tagsVisitHistory,
          DynamicTitle: configure.dynamicTitle,
          EnablePreferences: configure.enablePreferences,
          PreferencesPosition: configure.preferencesPosition,
          PageTransition: configure.pageTransition,
          TransitionProgress: configure.transitionProgress,
          TransitionLoading: configure.transitionLoading,
          ShortcutSearch: configure.shortcutSearch,
          ShortcutLock: configure.shortcutLock,
          ShortcutSidebar: configure.shortcutSidebar,
          ShortcutEnable: configure.shortcutEnable,
          ShortcutLockKeys: configure.shortcutLockKeys,
          ShortcutSidebarKeys: configure.shortcutSidebarKeys,
          ShortcutSearchKeys: configure.shortcutSearchKeys,
          ShortcutPreferencesKeys: configure.shortcutPreferencesKeys,
          ShortcutLogoutKeys: configure.shortcutLogoutKeys
        };
        const newConfig = cloneDeep(this.config);
        Object.assign(newConfig, configObj);
        configApi
          .setSiteConfig(newConfig)
          .then(res => {
            if (!silent) {
              message(transformI18n("layout.saveConfigSuccess"), {
                type: "success"
              });
            }
            resolve(res);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /**
     * 设置项变更后的自动保存（防抖 + 静默）——项目设置面板已改为实时生效，
     * 无需用户手动点「保存配置」。失败时提示一次，避免配置静默丢失。
     */
    autoSaveSiteConfig() {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        this.saveSiteConfig(true).catch(error => {
          message(transformI18n("layout.saveConfigFailed"), {
            type: "error"
          });
          console.warn("[site-config] auto save failed:", error);
        });
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    async getSiteConfig() {
      const { configApi } = await import("@/api/config");
      return new Promise<PlatformConfigs>((resolve, reject) => {
        configApi
          .getSiteConfig()
          .then(({ config }) => {
            if (config.Locale) {
              this.config = config as PlatformConfigs;
              const configObj = {
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
                  // 手点主题色（预设名或 custom）：缺省回落导航皮肤名
                  themeColor: config.ThemeColor ?? config.Theme ?? "light",
                  themeMode: config.ThemeMode ?? "light" // 整体风格（浅色：light、深色：dark、自动：system）
                },
                // 项目配置-界面显示
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
                  sidebarCollapsedShowTitle:
                    config.SidebarCollapsedShowTitle ?? false,
                  sidebarAutoActivateChild:
                    config.SidebarAutoActivateChild ?? false,
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
                  shortcutPreferencesKeys:
                    config.ShortcutPreferencesKeys ?? "mod+,",
                  shortcutLogoutKeys: config.ShortcutLogoutKeys ?? ""
                }
              } as PlatformConfigs;
              setConfig(config as PlatformConfigs);
              this.setSiteConfig(configObj);
              resolve(config as PlatformConfigs);
            } else {
              reject(config);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useSiteConfigStoreHook() {
  return useSiteConfigStore(store);
}
