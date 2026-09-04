import { defineStore } from "pinia";
import { setConfig } from "@/config";
import Storage from "responsive-storage";
import { message } from "@/utils/message";
import { cloneDeep } from "@pureadmin/utils";
import { responsiveStorageNameSpace, store } from "../utils";
import { configApi } from "@/api/config";

export const useSiteConfigStore = defineStore("pure-site-config", {
  state: () => ({
    config: {},
    nameSpace: responsiveStorageNameSpace()
  }),
  actions: {
    setSiteConfig(config: PlatformConfigs) {
      Object.keys(config).forEach(key => {
        Storage.set(`${this.nameSpace}${key}`, config[key]);
      });
    },
    async resetSiteConfig() {
      configApi.resetSiteConfig().then(() => {
        message("项目配置重置成功", { type: "success" });
        window.location.reload();
      });
    },
    async saveSiteConfig() {
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
            message("项目配置保存成功", { type: "success" });
            resolve(res);
          })
          .catch(error => {
            reject(error);
          });
      });
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
                  epThemeColor: config.EpThemeColor ?? "#409EFF",
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
