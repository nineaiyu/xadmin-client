import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { routerArrays } from "../types";
import { useGlobal } from "@pureadmin/utils";
import { useMultiTagsStore } from "@/store/modules/multiTags";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import { applyPreferenceAttributes } from "./usePreferenceAttributes";
import { buildConfigureDefaults } from "./layoutPreferences";

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
    /** 界面显示与交互偏好（缺省值构建见 layoutPreferences.ts，来源 platform-config.json 与后端 WEB_SITE_CONFIG 种子） */
    if (!$storage.configure) {
      $storage.configure = buildConfigureDefaults($config);
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
