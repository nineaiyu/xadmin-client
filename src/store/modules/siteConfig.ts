import type { PreferenceBaseline } from "@/utils/preferenceDiff";

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
    nameSpace: responsiveStorageNameSpace(),
    /**
     * 偏好比对基线（设置面板「撤销本次调整」脏标记 + 撤销回填值）：
     * 站点配置同步完成（或首次打开面板兜底）时对 locale / layout / configure
     * 三命名空间的深拷贝快照，与当前值比对得出「本次会话是否改过偏好」。
     */
    preferenceBaseline: null as PreferenceBaseline | null,
    /**
     * 最近一次与服务端同步（读取/保存成功）时的 layout/configure 快照。
     * 首屏会把站点配置回写本地存储（主题色 / 菜单布局等相同值），布局层的
     * 自动保存用它与当前值深比较，无差异时不发整包 PATCH——否则每次页面加载
     * 都会产生一次无意义写入。
     */
    syncedSnapshot: null as { layout: unknown; configure: unknown } | null
  }),
  actions: {
    setSiteConfig(config: PlatformConfigs) {
      Object.entries(config).forEach(([key, value]) => {
        Storage.set(`${this.nameSpace}${key}`, value);
      });
    },
    /**
     * 捕获偏好比对基线（站点配置同步完成后调用；每次调用整体替换）。
     * 基线同时是「撤销本次调整」的回填值，因此只在两处重捕：站点配置同步完成，
     * 以及布局层的**启动静默窗口**（首屏把站点配置回写本地存储的归一动作不算
     * 用户改动）；面板内继续修改不刷新基线（否则撤销会退化成「退到上一次改动」）。
     */
    capturePreferenceBaseline() {
      const locale = Storage.getData("locale", this.nameSpace);
      const layout = Storage.getData("layout", this.nameSpace);
      const configure = Storage.getData("configure", this.nameSpace);
      // 与 captureSyncedSnapshot 同口径用 cloneDeep（JSON 往返会丢失
      // undefined / Date 等形态，两套深拷贝口径在同一模块会埋不一致地雷）
      this.preferenceBaseline = cloneDeep({
        locale: locale ?? {},
        layout: layout ?? {},
        configure: configure ?? {}
      });
    },
    /**
     * 基线缺失时兜底捕获（设置面板打开路径）。
     * 仅捕获一次：面板内继续修改偏好不应刷新基线，否则脏标记恒为空。
     */
    ensurePreferenceBaseline() {
      if (!this.preferenceBaseline) {
        this.capturePreferenceBaseline();
      }
    },
    /** 捕获「已同步」快照（读取 / 保存成功后调用，供布局层跳过无差异的自动保存） */
    captureSyncedSnapshot() {
      this.syncedSnapshot = {
        layout: cloneDeep(Storage.getData("layout", this.nameSpace) ?? {}),
        configure: cloneDeep(Storage.getData("configure", this.nameSpace) ?? {})
      };
    },
    /**
     * 恢复默认：清除个人偏好配置行（`DELETE` 用户配置），重载后回落到站点生效值
     * （多数键 = 管理员统一的站点配置，站点级外观 9 键本就是系统配置）。
     * 只作用个人作用域，不动站点级配置——超管要把站点级外观一并恢复见面板的
     * 「恢复站点默认」。
     */
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
     * 面板级批量偏好的落库（「撤销本次调整」/「恢复站点默认」）：
     * 本地存储已就地改好后，走与逐项改动相同的整包 PATCH，差别是「立即保存 +
     * 成功提示」而非防抖静默。
     *
     * 调用约束：必须在写入本地存储**同一个同步块**内调用。此处先捕获已同步快照
     * （= 即将落库的值），让布局层常驻防抖监听判为无差异，避免同一批值被再 PATCH
     * 一次；跨 tick 调用时监听已排入队列，快照来不及生效。
     */
    async persistPreferences(successMessage: string) {
      this.captureSyncedSnapshot();
      try {
        await this.saveSiteConfig(true);
        message(successMessage, { type: "success" });
      } catch (error) {
        message(transformI18n("layout.saveConfigFailed"), { type: "error" });
        console.warn("[site-config] persist preferences failed:", error);
      }
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
          AuthPageLayout: configure.authPageLayout,
          Grey: configure.grey,
          Weak: configure.weak,
          HideTabs: configure.hideTabs,
          HideFooter: configure.hideFooter,
          FooterFixed: configure.footerFixed,
          FooterHeight: configure.footerHeight,
          Title: configure.title,
          ShowLogo: configure.showLogo,
          LogoSource: configure.logoSource,
          LogoShowText: configure.logoShowText,
          LogoFit: configure.logoFit,
          LogoMode: configure.logoMode,
          FullLogoHeight: configure.fullLogoHeight,
          LogoSourceDark: configure.logoSourceDark,
          Timezone: configure.timezone,
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
          NavigationSplit: configure.navigationSplit,
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
          HeaderMode: configure.headerMode,
          HeaderHidden: configure.headerHidden,
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
          NavbarTimezone: configure.navbarTimezone,
          NavbarOrder: configure.navbarOrder,
          NavbarMoreWidgets: configure.navbarMoreWidgets,
          WidgetPositions: configure.widgetPositions,
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
          TagsShowMaximize: configure.tagsShowMaximize,
          TagsHeight: configure.tagsHeight,
          TagsKeepAlive: configure.tagsKeepAlive,
          TagsVisitHistory: configure.tagsVisitHistory,
          DynamicTitle: configure.dynamicTitle,
          EnablePreferences: configure.enablePreferences,
          PreferencesPosition: configure.preferencesPosition,
          PreferencesStickyNav: configure.preferencesStickyNav,
          EnableCopyPreferences: configure.enableCopyPreferences,
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
            this.captureSyncedSnapshot();
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
                  authPageLayout: config.AuthPageLayout ?? "panel-left",
                  grey: config.Grey ?? false,
                  weak: config.Weak ?? false,
                  hideTabs: config.HideTabs ?? false,
                  // 缺省与 platform-config.json / WEB_SITE_CONFIG 种子一致：默认显示页脚
                  hideFooter: config.HideFooter ?? false,
                  footerFixed: config.FooterFixed ?? false,
                  footerHeight: config.FooterHeight ?? 0,
                  // 站点标题：后端下发优先，缺失时回落 platform-config 的 Title（responsive 注入）
                  title: config.Title ?? "",
                  showLogo: config.ShowLogo ?? true,
                  logoSource: config.LogoSource ?? "",
                  logoShowText: config.LogoShowText ?? true,
                  logoFit: config.LogoFit ?? "contain",
                  logoMode: config.LogoMode ?? "icon",
                  fullLogoHeight: config.FullLogoHeight ?? 32,
                  logoSourceDark: config.LogoSourceDark ?? "",
                  timezone: config.Timezone ?? "",
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
                  navigationSplit: config.NavigationSplit ?? true,
                  sidebarAccordion: config.SidebarAccordion ?? true,
                  sidebarCollapseButton: config.SidebarCollapseButton ?? true,
                  semiDarkSidebar: config.SemiDarkSidebar ?? false,
                  semiDarkHeader: config.SemiDarkHeader ?? false,
                  semiDarkSidebarSub: config.SemiDarkSidebarSub ?? false,
                  successColor: config.SuccessColor ?? "",
                  warningColor: config.WarningColor ?? "",
                  dangerColor: config.DangerColor ?? "",
                  sidebarWidth: config.SidebarWidth ?? 224,
                  sidebarExpandOnHover: config.SidebarExpandOnHover ?? true,
                  sidebarDraggable: config.SidebarDraggable ?? false,
                  sidebarCollapsedShowTitle:
                    config.SidebarCollapsedShowTitle ?? false,
                  sidebarAutoActivateChild:
                    config.SidebarAutoActivateChild ?? false,
                  headerFixed: config.HeaderFixed ?? true,
                  headerMode: config.HeaderMode ?? "",
                  headerHidden: config.HeaderHidden ?? false,
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
                  navbarTimezone: config.NavbarTimezone ?? false,
                  navbarOrder: config.NavbarOrder ?? [],
                  navbarMoreWidgets: config.NavbarMoreWidgets ?? [],
                  widgetPositions: config.WidgetPositions ?? {},
                  headerMenuAlign: config.HeaderMenuAlign ?? "start",
                  // 缺省值与 layout/hooks/preferenceAttributes 的
                  // DEFAULT_SIDEBAR_COLLAPSE_WIDTH 同源（60），勿用历史值
                  sidebarCollapseWidth: config.SidebarCollapseWidth ?? 60,
                  sidebarMixedWidth: config.SidebarMixedWidth ?? 0,
                  sidebarHidden: config.SidebarHidden ?? false,
                  sidebarFixedButton: config.SidebarFixedButton ?? false,
                  sidebarExtraCollapse: config.SidebarExtraCollapse ?? false,
                  tagsMiddleClickClose: config.TagsMiddleClickClose ?? true,
                  tagsWheelSwitch: config.TagsWheelSwitch ?? true,
                  tagsShowIcon: config.TagsShowIcon ?? true,
                  tagsShowRefresh: config.TagsShowRefresh ?? true,
                  tagsShowMore: config.TagsShowMore ?? true,
                  tagsShowMaximize: config.TagsShowMaximize ?? false,
                  // 与 layout/hooks/preferenceAttributes 的 DEFAULT_TAGS_HEIGHT 同源（38）
                  tagsHeight: config.TagsHeight ?? 38,
                  tagsKeepAlive: config.TagsKeepAlive ?? true,
                  tagsVisitHistory: config.TagsVisitHistory ?? true,
                  dynamicTitle: config.DynamicTitle ?? true,
                  enablePreferences: config.EnablePreferences ?? true,
                  preferencesPosition: config.PreferencesPosition ?? "header",
                  preferencesStickyNav: config.PreferencesStickyNav ?? true,
                  enableCopyPreferences: config.EnableCopyPreferences ?? true,
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
              // 同步完成后捕获偏好比对基线（设置面板重置脏标记的比对基准）
              this.capturePreferenceBaseline();
              // 已同步快照：首屏随后用相同值回写本地存储时不再触发整包保存
              this.captureSyncedSnapshot();
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
