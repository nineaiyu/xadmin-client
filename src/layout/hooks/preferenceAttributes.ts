import { hexToHslTriplet } from "@/utils/color";
import { SEMANTIC_COLOR_FIELDS } from "@/utils/themeConstants";
import { CUSTOM_THEME_PRESET, DEFAULT_THEME_PRESET } from "./themePresets";

/**
 * 偏好 → `<html>` 落点的实现域（常量 / 归一化纯函数 / 应用函数）。
 * 挂载期与运行期的接线见 usePreferenceAttributes.ts。
 *
 * - `data-radius` / `data-font`：档位；`--font-scale`：自定义字号倍率
 * - `--sidebar-width`：侧栏宽度；`html-grey` / `html-weakness`：整站效果类
 * - `semi-dark-sidebar` / `semi-dark-header`：浅色外观下的深色侧栏 / 顶栏
 *   （暗色外观本身即深色，由 CSS `:not(.dark)` 自动失效）
 * 默认档不写属性（DOM 与迁移前一致）；档位定义见 tokens/primitives.scss 末尾。
 */
const ATTRS = [
  { attr: "data-radius", key: "radius", fallback: "default" },
  { attr: "data-font", key: "fontScale", fallback: "default" }
] as const;

/** 主题预设属性：默认 / 自定义档不写属性（表面回到语义层内置取值） */
const THEME_PRESET_ATTR = "data-theme-preset";
const THEME_PRESET_SKIP: readonly string[] = [
  DEFAULT_THEME_PRESET,
  CUSTOM_THEME_PRESET
];

/** 导航风格（圆角 / 朴素）：圆角为默认档，不写属性 */
export const DEFAULT_NAVIGATION_STYLE = "rounded";
const NAVIGATION_STYLE_ATTR = "data-nav-style";

/** 页签项高度（px）+ 可调范围（与设置面板控件同源） */
export const DEFAULT_TAGS_HEIGHT = 34;
export const TAGS_HEIGHT_RANGE = { min: 28, max: 48, step: 2 } as const;

/** 页签高度取值钳制（配置缺失/越界时回落到基准值） */
export function normalizeTagsHeight(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_TAGS_HEIGHT;
  }
  const height = Number(value);
  if (!Number.isFinite(height)) return DEFAULT_TAGS_HEIGHT;
  return Math.min(
    TAGS_HEIGHT_RANGE.max,
    Math.max(TAGS_HEIGHT_RANGE.min, Math.round(height))
  );
}

/** 侧栏宽度基准（与 tokens/primitives.scss 的 `--sidebar-width` 一致） */
export const DEFAULT_SIDEBAR_WIDTH = 210;
/** 侧栏宽度可调范围（px）：与设置面板控件同源，读取端再做一次钳制 */
export const SIDEBAR_WIDTH_RANGE = { min: 160, max: 320 } as const;

/** 字号基准（px）：自定义档滑块按「基准字号」展示，倍率 = 基准 / 该值 */
export const FONT_BASE_PX = 14;
/** 自定义字号可调范围（px） */
export const FONT_SIZE_RANGE = { min: 12, max: 20, step: 0.5 } as const;

/** 侧栏折叠态宽度基准（与 tokens/primitives.scss 的 `--sidebar-collapse-width` 一致） */
export const DEFAULT_SIDEBAR_COLLAPSE_WIDTH = 54;
/** 侧栏折叠态宽度可调范围（px） */
export const SIDEBAR_COLLAPSE_WIDTH_RANGE = { min: 48, max: 96 } as const;
/** 侧栏折叠态宽度取值钳制 */
export function normalizeSidebarCollapseWidth(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SIDEBAR_COLLAPSE_WIDTH;
  }
  const width = Number(value);
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_COLLAPSE_WIDTH;
  return Math.min(
    SIDEBAR_COLLAPSE_WIDTH_RANGE.max,
    Math.max(SIDEBAR_COLLAPSE_WIDTH_RANGE.min, Math.round(width))
  );
}

/** 混合布局侧栏宽度：0 = 跟随「侧栏宽度」（默认档），>0 = 独立宽度（px） */
export const SIDEBAR_MIXED_WIDTH_RANGE = { min: 0, max: 320 } as const;
export function normalizeSidebarMixedWidth(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.min(
    SIDEBAR_WIDTH_RANGE.max,
    Math.max(SIDEBAR_WIDTH_RANGE.min, Math.round(width))
  );
}

/** 顶栏菜单对齐（水平 / 混合布局）：默认左对齐 */
export const DEFAULT_HEADER_MENU_ALIGN = "start";
const MENU_ALIGN_ATTR = "data-menu-align";

/** 侧栏宽度取值钳制（配置缺失/越界时回落到基准值） */
export function normalizeSidebarWidth(value: unknown): number {
  // 空值先判：`Number(null)` 为 0（有限值），会误落到区间下限
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  const width = Number(value);
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.min(
    SIDEBAR_WIDTH_RANGE.max,
    Math.max(SIDEBAR_WIDTH_RANGE.min, Math.round(width))
  );
}

/** 自定义字号基准钳制（px，缺失/越界回落基准值） */
export function normalizeFontBasePx(value: unknown): number {
  if (value === null || value === undefined || value === "")
    return FONT_BASE_PX;
  const size = Number(value);
  if (!Number.isFinite(size)) return FONT_BASE_PX;
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, size));
}

/** 应用档位属性（纯函数，可在任意时机调用） */
export function applyPreferenceAttributes(
  configure: ResponsiveStorage["configure"] | undefined
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isCustomFont = configure?.fontScale === "custom";

  ATTRS.forEach(({ attr, key, fallback }) => {
    const value = configure?.[key] ?? fallback;
    if (!value || value === fallback) root.removeAttribute(attr);
    else root.setAttribute(attr, value);
  });

  // 自定义字号：内联倍率覆写（data-font="custom" 无对应样式规则，取内联值）
  if (isCustomFont) {
    const scale =
      normalizeFontBasePx(configure?.fontScaleCustom ?? FONT_BASE_PX) /
      FONT_BASE_PX;
    root.style.setProperty("--font-scale", String(Number(scale.toFixed(4))));
  } else {
    root.style.removeProperty("--font-scale");
  }

  // 侧栏宽度：默认档撤除内联覆写，回到设计令牌基准值
  const width = configure?.sidebarWidth;
  if (width === undefined || width === DEFAULT_SIDEBAR_WIDTH) {
    root.style.removeProperty("--sidebar-width");
  } else {
    root.style.setProperty(
      "--sidebar-width",
      `${normalizeSidebarWidth(width)}px`
    );
  }

  // 主题预设：只落属性，表面令牌取值见 tokens/presets.scss（主色由面板选择时经
  // themePresets 写入内联 --primary，见 themeColorScheme）
  const themePreset = configure?.themePreset ?? DEFAULT_THEME_PRESET;
  if (THEME_PRESET_SKIP.includes(String(themePreset))) {
    root.removeAttribute(THEME_PRESET_ATTR);
  } else {
    root.setAttribute(THEME_PRESET_ATTR, String(themePreset));
  }

  // 导航风格：朴素档去掉菜单激活块圆角与内缩（取值见 tokens/primitives.scss）
  const navigationStyle =
    configure?.navigationStyle ?? DEFAULT_NAVIGATION_STYLE;
  if (navigationStyle === DEFAULT_NAVIGATION_STYLE) {
    root.removeAttribute(NAVIGATION_STYLE_ATTR);
  } else {
    root.setAttribute(NAVIGATION_STYLE_ATTR, String(navigationStyle));
  }

  // 顶栏菜单对齐（水平 / 混合布局）：默认档（start）不写属性
  const menuAlign = configure?.headerMenuAlign ?? DEFAULT_HEADER_MENU_ALIGN;
  if (menuAlign === DEFAULT_HEADER_MENU_ALIGN) {
    root.removeAttribute(MENU_ALIGN_ATTR);
  } else {
    root.setAttribute(MENU_ALIGN_ATTR, String(menuAlign));
  }

  // 侧栏折叠宽度 / 混合布局宽度：默认档撤除内联覆写，回到设计令牌取值
  const collapseWidth = configure?.sidebarCollapseWidth;
  if (
    collapseWidth === undefined ||
    normalizeSidebarCollapseWidth(collapseWidth) ===
      DEFAULT_SIDEBAR_COLLAPSE_WIDTH
  ) {
    root.style.removeProperty("--sidebar-collapse-width");
  } else {
    root.style.setProperty(
      "--sidebar-collapse-width",
      `${normalizeSidebarCollapseWidth(collapseWidth)}px`
    );
  }

  const mixedWidth = normalizeSidebarMixedWidth(configure?.sidebarMixedWidth);
  if (mixedWidth === 0) {
    root.style.removeProperty("--sidebar-mixed-width");
  } else {
    root.style.setProperty("--sidebar-mixed-width", `${mixedWidth}px`);
  }

  // 页签项高度：默认档撤除内联覆写，回到设计令牌基准值
  // （顶栏 + 页签条的固定头部总高由令牌 calc 派生，见 tokens/primitives.scss）
  const tagsHeight = configure?.tagsHeight;
  if (
    tagsHeight === undefined ||
    normalizeTagsHeight(tagsHeight) === DEFAULT_TAGS_HEIGHT
  ) {
    root.style.removeProperty("--layout-tags-item-h");
  } else {
    root.style.setProperty(
      "--layout-tags-item-h",
      `${normalizeTagsHeight(tagsHeight)}px`
    );
  }

  // 语义色（成功 / 警告 / 危险）：自定义时覆写基础令牌三元组，
  // 空串撤除内联覆写、回到 primitives.scss 的内置取值（EP 色阶由 ep-bridge 派生）
  SEMANTIC_COLOR_FIELDS.forEach(({ key, cssVar }) => {
    const value = configure?.[key];
    const triplet =
      typeof value === "string" && value ? hexToHslTriplet(value) : "";
    if (triplet) root.style.setProperty(cssVar, triplet);
    else root.style.removeProperty(cssVar);
  });

  // 整站效果类：面板未挂载（懒加载）时同样需要生效
  root.classList.toggle("html-grey", Boolean(configure?.grey));
  root.classList.toggle("html-weakness", Boolean(configure?.weak));
  root.classList.toggle(
    "semi-dark-sidebar",
    Boolean(configure?.semiDarkSidebar)
  );
  root.classList.toggle("semi-dark-header", Boolean(configure?.semiDarkHeader));
  root.classList.toggle(
    "semi-dark-sidebar-sub",
    Boolean(configure?.semiDarkSidebarSub)
  );
}
