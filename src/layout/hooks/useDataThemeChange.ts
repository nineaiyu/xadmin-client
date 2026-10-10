import { onMounted, onUnmounted, ref } from "vue";
import { useLayout } from "./useLayout";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { useGlobal } from "@pureadmin/utils";
import {
  createThemeColorScheme,
  themeColors,
  toggleClass
} from "./themeColorScheme";
import { createAppReset } from "./appReset";
import { withCircleReveal } from "@/utils/viewTransition";

/**
 * 深浅色与主题色切换：主题色方案见 themeColorScheme.ts，重置流程见 appReset.ts，
 * 明暗切换的圆形揭示动效见 utils/viewTransition.ts。
 */
export function useDataThemeChange() {
  const { layoutTheme, layout } = useLayout();

  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const dataTheme = ref<boolean>($storage?.layout?.darkMode ?? false);
  const themeMode = ref<string>($storage?.layout?.themeMode ?? "");
  const body = document.documentElement as HTMLElement;

  const { setEpThemeColor, setLayoutThemeColor, setCustomThemeColor } =
    createThemeColorScheme({
      layoutTheme,
      layout,
      dataTheme,
      themeMode,
      storage: $storage
    });

  /**
   * 浅色、深色整体风格切换。
   *
   * 状态与持久化（`$storage.layout`、EP 主题色）**同步完成**；只有暗色 class
   * 这一视觉动作放进圆形揭示动效（见 utils/viewTransition.ts）——View Transition
   * 的回调会被推迟到下一次渲染，若把存储写入放进去，站点配置自动保存会读到旧值
   * （实测表现为「切深色后刷新回浅色」）。
   */
  function dataThemeChange(overall?: string) {
    themeMode.value = overall ?? "";
    if (useEpThemeStoreHook().epTheme === "light" && dataTheme.value) {
      setLayoutThemeColor("default", false);
    } else {
      setLayoutThemeColor(useEpThemeStoreHook().epTheme, false);
    }
    if (!dataTheme.value && $storage.layout.themeColor === "light") {
      setLayoutThemeColor("light", false);
    }

    withCircleReveal(() => {
      document.documentElement.classList.toggle("dark", dataTheme.value);
    });
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
    setLayoutThemeColor,
    setCustomThemeColor
  };
}

/**
 * 「跟随系统」的常驻监听：操作系统明暗变化时即时应用（仅 `themeMode === "system"` 生效）。
 *
 * 挂在布局层而非设置面板内——面板内容按需挂载（打开时才渲染），监听若随面板卸载
 * 会丢；模式判定读 `$storage.layout.themeMode`（面板改动写入同一处，避免快照过期）。
 */
export function useSystemThemeWatch() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");

  function applySystemTheme() {
    if (($storage?.layout?.themeMode ?? "") !== "system") return;
    const { dataTheme, dataThemeChange } = useDataThemeChange();
    dataTheme.value = mediaQueryList.matches;
    dataThemeChange("system");
  }

  onMounted(() => {
    applySystemTheme();
    mediaQueryList.addEventListener("change", applySystemTheme);
  });

  onUnmounted(() =>
    mediaQueryList.removeEventListener("change", applySystemTheme)
  );

  return { applySystemTheme };
}
