import { ref } from "vue";
import { useLayout } from "./useLayout";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { useGlobal } from "@pureadmin/utils";
import {
  createThemeColorScheme,
  themeColors,
  toggleClass
} from "./themeColorScheme";
import { createAppReset } from "./appReset";

/**
 * 深浅色与主题色切换：主题色方案见 themeColorScheme.ts，重置流程见 appReset.ts。
 */
export function useDataThemeChange() {
  const { layoutTheme, layout } = useLayout();

  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const dataTheme = ref<boolean>($storage?.layout?.darkMode ?? false);
  const themeMode = ref<string>($storage?.layout?.themeMode ?? "");
  const body = document.documentElement as HTMLElement;

  const { setEpThemeColor, setLayoutThemeColor } = createThemeColorScheme({
    layoutTheme,
    layout,
    dataTheme,
    themeMode,
    storage: $storage
  });

  /** 浅色、深色整体风格切换 */
  function dataThemeChange(overall?: string) {
    themeMode.value = overall ?? "";
    if (useEpThemeStoreHook().epTheme === "light" && dataTheme.value) {
      setLayoutThemeColor("default", false);
    } else {
      setLayoutThemeColor(useEpThemeStoreHook().epTheme, false);
    }

    if (dataTheme.value) {
      document.documentElement.classList.add("dark");
    } else {
      if ($storage.layout.themeColor === "light") {
        setLayoutThemeColor("light", false);
      }
      document.documentElement.classList.remove("dark");
    }
  }

  const onReset = createAppReset({ setEpThemeColor });

  return {
    body,
    dataTheme,
    themeMode,
    layoutTheme,
    themeColors,
    onReset,
    toggleClass,
    dataThemeChange,
    setEpThemeColor,
    setLayoutThemeColor
  };
}
