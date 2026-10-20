import { storageLocal } from "@pureadmin/utils";
import { getConfig, responsiveStorageNameSpace } from "@/config";
import { hexToHslTriplet } from "./color";
import { DEFAULT_EP_THEME_COLOR } from "./themeConstants";
import { readConfigurePreferences } from "./preferences";
import { resolveThemePrimaryHex } from "@/layout/hooks/themeColorScheme";

/**
 * 装配期主题应用（`main.ts` 在 mount 前调用一次）。
 *
 * 大屏投屏 / 设计器是 `showLink: false` 的菜单外全屏路由（无 Layout），登录页同样
 * 不挂 Layout：布局 `onBeforeMount` 里的主题初始化不会执行，`data-theme`（菜单调色板
 * 皮肤）、`html.dark`（站点暗色）、`--primary`（自定义主色）三项都会缺失——表现是
 * 直开全屏页时菜单 / 图表取色回退缺省，返回管理页后主题错乱。
 *
 * 口径与布局期一致（主色优先级复用 `resolveThemePrimaryHex`），但**不写存储**：
 * 装配期只做视觉落点，持久化仍归布局层（避免首屏把站点配置同步的既有值再改写一次）。
 * 布局内调用保留（站点配置异步到达后重应用），两处写入同值，幂等。
 *
 * 依赖刻意保持精简（不引 layout hooks）：该模块在首屏入口闭包内，体积按 KB 计。
 */

/** 持久化的布局偏好（装配期用；组件内请用 `$storage.layout`） */
function readStoredLayout(): Partial<StorageConfigs> {
  return (
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}layout`
    ) ?? {}
  );
}

/** 生效明暗：跟随系统时读系统偏好，其余按已存的 darkMode（与布局期判定同口径） */
export function resolveBootDarkMode(layout: Partial<StorageConfigs>): boolean {
  if (String(layout.themeMode ?? "") === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return Boolean(layout.darkMode ?? getConfig().DarkMode ?? false);
}

/** 把站点主题落到 `<html>`：暗色类 + 导航皮肤 + 主色令牌（默认主色撤除内联覆写） */
export function applyBootTheme(): void {
  if (typeof document === "undefined") return;
  const config = getConfig();
  const layout = readStoredLayout();
  const dark = resolveBootDarkMode(layout);
  const theme = String(layout.theme ?? config.Theme ?? "light");
  const root = document.documentElement;

  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", theme);

  const primary = resolveThemePrimaryHex({
    theme,
    themeColor: layout.themeColor,
    epThemeColor: layout.epThemeColor,
    preset: readConfigurePreferences().themePreset,
    dark,
    isClick: false
  });
  // 默认主色直接用设计令牌，不写等价三元组（与 setEpThemeColor 同口径）
  if (primary.toLowerCase() === DEFAULT_EP_THEME_COLOR) {
    root.style.removeProperty("--primary");
    return;
  }
  const triplet = hexToHslTriplet(primary);
  if (triplet) root.style.setProperty("--primary", triplet);
}
