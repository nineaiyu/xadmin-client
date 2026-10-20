/**
 * 图表配色语义化工具。
 *
 * 背景：多处图表系列色与 Element Plus 语义色同名同值却硬编码（#409eff 等约 30 处），
 * 用户自定义主题色（`setEpThemeColor`）或暗色主题下图表不跟随，且主色存在双源真理。
 * 口径：EP 语义色统一经 CSS 变量读取（浏览器环境），非浏览器/变量缺失时回退 EP 默认值
 * （与原硬编码完全一致，默认主题下零视觉差异）。
 *
 * 取色返回值保证是 ECharts 可解析的**字面量**：项目 EP 桥接层把变量写成
 * `hsl(var(--primary))` / `color-mix(...)` 形态，computed value 不会自动展开，
 * 必须经浏览器探针解析（见 resolveColorLiteral），否则 zrender 解析不出颜色、
 * 状态动画（悬停高亮等）插值时会持续抛 TypeError。
 *
 * 注意：函数在调用时读取（而非模块加载时求值），主题切换后下次渲染即跟随。
 */

const EP_COLOR_FALLBACK = {
  primary: "#006be6",
  success: "#57d188",
  warning: "#efbd48",
  danger: "#ff3860",
  info: "#909399"
} as const;

/** EP 浅色档（`-light-9`）回退值：与默认主题下的 tint 底色一致（默认语义色的 10% + 白） */
const EP_LIGHT_FALLBACK = {
  primary: "#e6f0fd",
  success: "#eefaf3",
  warning: "#fdf8ed",
  danger: "#ffebef",
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

/**
 * 颜色解析探针（惰性创建、全局复用）+ 规范化。
 *
 * 项目的 EP 桥接层把颜色写成 `hsl(var(--primary))`、`color-mix(...)` 形态，
 * 自定义属性的 computed value 展开后得到 CSS Color 4 的空格语法
 * （如 `hsl(0 0% 100%)`）——**zrender 的颜色解析只认逗号语法**，拿它做渐变色
 * 会让 colorStops 落成 undefined，悬停等状态动画插值时持续抛
 * `Cannot read properties of undefined (reading 'length')`。
 * 这里交给浏览器解析，返回 zrender 可消费的 `rgb(...)` 字面量。
 */
let colorProbe: HTMLElement | null = null;

/** 变量值 → ECharts 可消费的字面量色值；解析不出时返回 null（调用方回退） */
function resolveColorLiteral(raw: string): string | null {
  // zrender 可直接解析的形态：hex 与逗号语法的 rgb()/rgba()
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw) || /^rgba?\(/.test(raw)) {
    return raw;
  }
  if (typeof document === "undefined" || !document.body) {
    return null;
  }
  // 语法层面就不合法的值直接放弃（含未定义变量的值无法在此判定，走探针兜底）
  if (typeof CSS !== "undefined" && !CSS.supports("color", raw)) {
    return null;
  }
  colorProbe ??= (() => {
    const el = document.createElement("span");
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  })();
  colorProbe.style.color = raw;
  const resolved = getComputedStyle(colorProbe).color;
  return /^rgb/.test(resolved) ? resolved : null;
}

/** 读取当前主题下的任意 CSS 变量色值（图表只接受字面量，不能消费 `var()`）。 */
export function cssVarColor(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return fallback;
  return resolveColorLiteral(value) ?? fallback;
}

/** 读取当前主题下的 EP 语义色（跟随自定义主色/暗色主题）。 */
export function epColor(name: EpColorName): string {
  return cssVarColor(`--el-color-${name}`, EP_COLOR_FALLBACK[name]);
}

/**
 * 读取 EP 语义色的浅色档（tint 底色，图表背景/图标底托用）。
 * 暗色主题下 EP 会把 `-light-N` 重定义为深色适配值，故两者都跟随主题。
 */
export function epColorLight(name: EpColorName): string {
  return cssVarColor(`--el-color-${name}-light-9`, EP_LIGHT_FALLBACK[name]);
}

/** 图表配色方案（坐标轴 / 图例 / tooltip / 导出底色） */
export interface ChartColorScheme {
  /** 主要文字：tooltip 正文 */
  text: string;
  /** 次要文字：坐标轴标签、图例 */
  textSecondary: string;
  /** 坐标轴线与刻度 */
  axisLine: string;
  /** 网格分隔线 */
  splitLine: string;
  /** tooltip 底色 */
  tooltipBg: string;
  /** tooltip 描边 */
  tooltipBorder: string;
  /** 饼图扇区描边：亮色用图表底色形成留白，暗色透明露出卡片底色 */
  pieBorder: string;
  /** 图片导出底色（透明底在深色面板上不可读） */
  exportBg: string;
}

/**
 * 图表配色方案。
 *
 * `dark=true` 用于站点暗色主题与**恒深色大屏/投屏**（`ChartCard` 的 `forceDark`）。
 * 后者站点可能仍是亮色，EP 变量取到的是亮色值；若继续走 `cssVarColor`，图表会
 * 被画成白底黑字，与深色画布割裂。因此暗色分支使用固定深色基线（与 EP 暗色
 * 主题同值），不读站点变量。
 */
export function chartColorScheme(dark: boolean): ChartColorScheme {
  if (dark) {
    return {
      text: "#e5eaf3",
      textSecondary: "#cfd3dc",
      axisLine: "#4c4d4f",
      splitLine: "rgba(255, 255, 255, 0.12)",
      tooltipBg: "#1d1e1f",
      tooltipBorder: "#4c4d4f",
      pieBorder: "transparent",
      exportBg: "#1d1e1f"
    };
  }
  const overlay = cssVarColor("--el-bg-color-overlay", "#ffffff");
  return {
    text: cssVarColor("--el-text-color-primary", "#303133"),
    textSecondary: cssVarColor("--el-text-color-regular", "#606266"),
    axisLine: cssVarColor("--el-border-color", "#dcdfe6"),
    splitLine: cssVarColor("--el-border-color-lighter", "#ebeef5"),
    tooltipBg: overlay,
    tooltipBorder: cssVarColor("--el-border-color-lighter", "#ebeef5"),
    pieBorder: overlay,
    exportBg: overlay
  };
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
