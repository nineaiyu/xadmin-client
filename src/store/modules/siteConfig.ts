import { defineStore } from "pinia";
import { setConfig } from "@/config";
import Storage from "responsive-storage";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { cloneDeep } from "@pureadmin/utils";
import { responsiveStorageNameSpace, store } from "../utils";
import { configApi } from "@/api/config";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";

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
      return new Promise((resolve, reject) => {
        const locale = Storage.getData("locale", this.nameSpace);
        const layout = Storage.getData("layout", this.nameSpace);
        const configure = Storage.getData("configure", this.nameSpace);
        const configObj = {
          Locale: locale.locale,
          Layout: layout.layout,
          Theme: layout.theme,
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
          Watermark: configure.watermark,
          WatermarkText: configure.watermarkText
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
                  themeColor: config.Theme ?? "light", // 主题色（对应项目配置中的主题色，与theme不同的是它不会受到浅色、深色整体风格切换的影响，只会在手动点击主题色时改变）
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
                  watermark: config.Watermark ?? false,
                  watermarkText: config.WatermarkText ?? ""
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
