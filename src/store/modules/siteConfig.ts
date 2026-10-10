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
          ShowLogo: configure.showLogo,
          TagsStyle: configure.tagsStyle,
          MultiTagsCache: configure.multiTagsCache,
          Stretch: configure.stretch,
          HeaderAutoHide: configure.headerAutoHide,
          CompactMode: configure.compactMode,
          Radius: configure.radius,
          FontScale: configure.fontScale,
          FontScaleCustom: configure.fontScaleCustom,
          SidebarAccordion: configure.sidebarAccordion,
          SidebarCollapseButton: configure.sidebarCollapseButton,
          SemiDarkSidebar: configure.semiDarkSidebar,
          SemiDarkHeader: configure.semiDarkHeader,
          SidebarWidth: configure.sidebarWidth,
          HeaderFixed: configure.headerFixed,
          BreadcrumbVisible: configure.breadcrumbVisible,
          MaxTagsCount: configure.maxTagsCount,
          NavbarSearch: configure.navbarSearch,
          NavbarLanguage: configure.navbarLanguage,
          NavbarFullscreen: configure.navbarFullscreen,
          NavbarLock: configure.navbarLock,
          NavbarNotice: configure.navbarNotice,
          TagsMiddleClickClose: configure.tagsMiddleClickClose,
          TagsWheelSwitch: configure.tagsWheelSwitch,
          DynamicTitle: configure.dynamicTitle,
          PageTransition: configure.pageTransition,
          ShortcutSearch: configure.shortcutSearch,
          ShortcutLock: configure.shortcutLock,
          ShortcutSidebar: configure.shortcutSidebar
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
                  showLogo: config.ShowLogo ?? true,
                  tagsStyle: config.TagsStyle ?? "chrome",
                  multiTagsCache: config.MultiTagsCache ?? false,
                  stretch: config.Stretch ?? false,
                  headerAutoHide: config.HeaderAutoHide ?? false,
                  compactMode: config.CompactMode ?? false,
                  radius: config.Radius ?? "default",
                  fontScale: config.FontScale ?? "default",
                  fontScaleCustom: config.FontScaleCustom ?? 14,
                  sidebarAccordion: config.SidebarAccordion ?? true,
                  sidebarCollapseButton: config.SidebarCollapseButton ?? true,
                  semiDarkSidebar: config.SemiDarkSidebar ?? false,
                  semiDarkHeader: config.SemiDarkHeader ?? false,
                  sidebarWidth: config.SidebarWidth ?? 210,
                  headerFixed: config.HeaderFixed ?? true,
                  breadcrumbVisible: config.BreadcrumbVisible ?? true,
                  maxTagsCount: config.MaxTagsCount ?? 0,
                  navbarSearch: config.NavbarSearch ?? true,
                  navbarLanguage: config.NavbarLanguage ?? true,
                  navbarFullscreen: config.NavbarFullscreen ?? true,
                  navbarLock: config.NavbarLock ?? true,
                  navbarNotice: config.NavbarNotice ?? true,
                  tagsMiddleClickClose: config.TagsMiddleClickClose ?? true,
                  tagsWheelSwitch: config.TagsWheelSwitch ?? true,
                  dynamicTitle: config.DynamicTitle ?? true,
                  pageTransition: config.PageTransition ?? "fade-transform",
                  shortcutSearch: config.ShortcutSearch ?? true,
                  shortcutLock: config.ShortcutLock ?? true,
                  shortcutSidebar: config.ShortcutSidebar ?? true
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
