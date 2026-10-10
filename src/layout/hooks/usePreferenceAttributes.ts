import { watch } from "vue";
import { useGlobal } from "@pureadmin/utils";

/**
 * 需要在 CSS 层生效的偏好 → `<html>` 的 data 属性 / CSS 变量 / 全局 class。
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

/** 侧栏宽度基准（与 tokens/primitives.scss 的 `--sidebar-width` 一致） */
export const DEFAULT_SIDEBAR_WIDTH = 210;
/** 侧栏宽度可调范围（px）：与设置面板控件同源，读取端再做一次钳制 */
export const SIDEBAR_WIDTH_RANGE = { min: 160, max: 320 } as const;

/** 字号基准（px）：自定义档滑块按「基准字号」展示，倍率 = 基准 / 该值 */
export const FONT_BASE_PX = 14;
/** 自定义字号可调范围（px） */
export const FONT_SIZE_RANGE = { min: 12, max: 20, step: 0.5 } as const;

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

  // 整站效果类：面板未挂载（懒加载）时同样需要生效
  root.classList.toggle("html-grey", Boolean(configure?.grey));
  root.classList.toggle("html-weakness", Boolean(configure?.weak));
  root.classList.toggle(
    "semi-dark-sidebar",
    Boolean(configure?.semiDarkSidebar)
  );
  root.classList.toggle("semi-dark-header", Boolean(configure?.semiDarkHeader));
}

/**
 * 挂载期同步 + 运行期跟随：设置面板改动与服务端站点配置回填都会写入
 * `$storage.configure`，此处统一落到属性上（在 `layout/index.vue` 调用一次）。
 */
export function usePreferenceAttributes() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  applyPreferenceAttributes($storage?.configure);
  watch(
    () => [
      $storage?.configure?.radius,
      $storage?.configure?.fontScale,
      $storage?.configure?.fontScaleCustom,
      $storage?.configure?.sidebarWidth,
      $storage?.configure?.grey,
      $storage?.configure?.weak,
      $storage?.configure?.semiDarkSidebar,
      $storage?.configure?.semiDarkHeader
    ],
    () => applyPreferenceAttributes($storage?.configure)
  );
}
