import { onMounted, onUnmounted } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useDataThemeChange } from "./useDataThemeChange";

/**
 * 「跟随系统」的常驻监听：操作系统明暗变化时即时应用（仅 `themeMode === "system"` 生效）。
 *
 * 挂在布局层而非设置面板内——面板内容按需挂载（打开时才渲染），监听若随面板卸载
 * 会丢；模式判定读 `$storage.layout.themeMode`（面板改动写入同一处，避免快照过期）。
 * `useDataThemeChange` 内部缓存了布局存储引用，事件回调期调用不再依赖组件实例。
 */
export function useSystemThemeWatch() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");

  function applySystemTheme() {
    if (($storage?.layout?.themeMode ?? "") !== "system") return;
    const { dataTheme, dataThemeChange } = useDataThemeChange();
    dataTheme.value = mediaQueryList.matches;
    // 外部事件（含挂载时的首次同步）不播揭示动效：无用户指针落点可作圆心
    dataThemeChange("system", { animate: false });
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
