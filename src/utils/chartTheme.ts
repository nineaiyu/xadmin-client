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
  primary: "#006be6",
  success: "#67c23a",
  warning: "#e6a23c",
  danger: "#f56c6c",
  info: "#909399"
} as const;

/** EP 浅色档（`-light-9`）回退值：与默认主题下的 tint 底色一致（默认主色的 10% + 白） */
const EP_LIGHT_FALLBACK = {
  primary: "#e6f0fd",
  success: "#f0f9eb",
  warning: "#fdf6ec",
  danger: "#fef0f0",
  info: "#f4f4f5"
} as const;

/** 图表专用强调色：无 EP 语义对应的第 6 系列色，集中定义避免页面层散落写死 */
export const CHART_ACCENT = "#9a66e4";

/**
 * 图表文字字体栈回退值：与 tokens/primitives.scss 的 `--font-family-base` 同源
 * （CSS 变量缺失时使用，保证图表文字不落回浏览器默认 sans-serif）。
 */
export const CHART_FALLBACK_FONT_FAMILY =
  '-apple-system, "Segoe UI", roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

/**
 * 图表文字字体栈：zrender 把 font-family 写进 SVG `<text>` 的行内样式（或 canvas
 * 字体串），外部 CSS（含 `--el-font-family` 桥接）覆盖不到，只能在 init 的主题层注入。
 * 运行时读取 `--font-family-base` 并折叠 SCSS 多行值里的换行/空白。
 */
export function chartFontFamily(): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return CHART_FALLBACK_FONT_FAMILY;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-family-base")
    .replace(/\s+/g, " ")
    .trim();
  return value || CHART_FALLBACK_FONT_FAMILY;
}

/**
 * ECharts 主题对象：仅注入字体栈（其他全部沿用内置默认/页面 option）。
 * 由 `plugins/echarts.ts` 在加载时注册为 `light` / `dark` 两个主题名——
 * 与 `useECharts` 的 `theme: computed(() => isDark ? "dark" : "light")` 约定配对，
 * 页面侧零改动即可让图表文字跟随应用字体栈。
 */
export function chartTextTheme(): { textStyle: { fontFamily: string } } {
  return { textStyle: { fontFamily: chartFontFamily() } };
}

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

/**
 * 给色值附加透明度（图表渐变端点用；ECharts 只接受字面量，不能消费 CSS 变量）。
 *
 * 支持 `#rgb` / `#rrggbb` / `rgb()` / `rgba()`；无法识别的格式原样返回
 * （宁可无渐变也不要渲染出错）。
 */
export function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  let rgb: [number, number, number] | null = null;
  const shortHex = /^#([0-9a-f]{3})$/i.exec(value);
  const fullHex = /^#([0-9a-f]{6})$/i.exec(value);
  const rgbFn = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
  if (fullHex) {
    rgb = [
      parseInt(fullHex[1].slice(0, 2), 16),
      parseInt(fullHex[1].slice(2, 4), 16),
      parseInt(fullHex[1].slice(4, 6), 16)
    ];
  } else if (shortHex) {
    rgb = [
      parseInt(shortHex[1][0].repeat(2), 16),
      parseInt(shortHex[1][1].repeat(2), 16),
      parseInt(shortHex[1][2].repeat(2), 16)
    ];
  } else if (rgbFn) {
    rgb = [Number(rgbFn[1]), Number(rgbFn[2]), Number(rgbFn[3])];
  }
  if (!rgb) return value;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
