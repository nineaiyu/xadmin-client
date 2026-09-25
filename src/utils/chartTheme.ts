/**
 * 图表配色语义化工具（T3 治理）。
 *
 * 背景：多处图表系列色与 Element Plus 语义色同名同值却硬编码（#409eff 等约 30 处），
 * 用户自定义主题色（`setEpThemeColor`）或暗色主题下图表不跟随，且主色存在双源真理。
 * 口径：EP 语义色统一经 CSS 变量读取（浏览器环境），非浏览器/变量缺失时回退 EP 默认值
 * （与原硬编码完全一致，默认主题下零视觉差异）。
 *
 * 注意：函数在调用时读取（而非模块加载时求值），主题切换后下次渲染即跟随。
 */

const EP_COLOR_FALLBACK = {
  primary: "#409eff",
  success: "#67c23a",
  warning: "#e6a23c",
  danger: "#f56c6c",
  info: "#909399"
} as const;

/** EP 浅色档（`-light-9`）回退值：与默认主题下的 tint 底色一致 */
const EP_LIGHT_FALLBACK = {
  primary: "#ecf5ff",
  success: "#f0f9eb",
  warning: "#fdf6ec",
  danger: "#fef0f0",
  info: "#f4f4f5"
} as const;

/** 图表专用强调色：无 EP 语义对应的第 6 系列色，集中定义避免页面层散落写死 */
export const CHART_ACCENT = "#9a66e4";

export type EpColorName = keyof typeof EP_COLOR_FALLBACK;

/** 读取当前主题下的任意 CSS 变量色值（图表只接受字面量，不能消费 `var()`）。 */
export function cssVarColor(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** 读取当前主题下的 EP 语义色（跟随自定义主色/暗色主题）。 */
export function epColor(name: EpColorName): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return EP_COLOR_FALLBACK[name];
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--el-color-${name}`)
    .trim();
  return value || EP_COLOR_FALLBACK[name];
}

/**
 * 读取 EP 语义色的浅色档（tint 底色，图表背景/图标底托用）。
 * 暗色主题下 EP 会把 `-light-N` 重定义为深色适配值，故两者都跟随主题。
 */
export function epColorLight(name: EpColorName): string {
  return cssVarColor(`--el-color-${name}-light-9`, EP_LIGHT_FALLBACK[name]);
}
