import type { CSSProperties } from "vue";

/**
 * Logo 展示派生（纯函数域）：侧栏 Logo 与顶栏 Logo 共用同一套取值口径。
 *
 * - `logoMode`：`icon`（默认，图标 + 标题文字，图片高 32px）/ `full`（整图，
 *   图片含图标与文字，按 `fullLogoHeight` 定高且不再单独渲染标题）；
 * - `logoSourceDark`：暗色外观下的专用图（空 = 与浅色共用 `logoSource`）；
 * - `logoSource` / `logoShowText` / `logoFit`：既有三键语义不变。
 */

/** 整图 Logo 高度基准（px）与可调范围（与设置面板控件同源） */
export const DEFAULT_FULL_LOGO_HEIGHT = 32;
export const FULL_LOGO_HEIGHT_RANGE = { min: 24, max: 96, step: 2 } as const;
/** 图标 Logo 的固定高度（与既有样式一致，不参与偏好） */
export const ICON_LOGO_HEIGHT = 32;

export type LogoMode = "icon" | "full";

export function resolveLogoMode(configure: unknown): LogoMode {
  const mode = (configure as ResponsiveStorage["configure"] | undefined)
    ?.logoMode;
  return mode === "full" ? "full" : "icon";
}

/** 整图高度钳制（缺失 / 越界回落基准值） */
export function normalizeFullLogoHeight(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_FULL_LOGO_HEIGHT;
  }
  const height = Number(value);
  if (!Number.isFinite(height)) return DEFAULT_FULL_LOGO_HEIGHT;
  return Math.min(
    FULL_LOGO_HEIGHT_RANGE.max,
    Math.max(FULL_LOGO_HEIGHT_RANGE.min, Math.round(height))
  );
}

/** Logo 图源：暗色专用图优先（仅暗色外观且已配置时） */
export function resolveLogoSrc(
  configure: ResponsiveStorage["configure"] | undefined,
  fallback: string,
  isDark: boolean
): string {
  const source = String(configure?.logoSource ?? "").trim();
  const darkSource = String(configure?.logoSourceDark ?? "").trim();
  if (isDark && darkSource) return darkSource;
  return source || fallback;
}

/** Logo 图片样式：整图模式按偏好定高，图标模式高度交给样式表 */
export function resolveLogoImageStyle(
  configure: ResponsiveStorage["configure"] | undefined
): CSSProperties {
  const fit = (configure?.logoFit ?? "contain") as CSSProperties["objectFit"];
  if (resolveLogoMode(configure) === "full") {
    return {
      objectFit: fit,
      height: `${normalizeFullLogoHeight(configure?.fullLogoHeight)}px`
    };
  }
  return { objectFit: fit };
}

/** 是否单独渲染平台标题文字：整图模式恒不渲染（文字已在图内） */
export function resolveLogoTextVisible(
  configure: ResponsiveStorage["configure"] | undefined
): boolean {
  if (resolveLogoMode(configure) === "full") return false;
  return configure?.logoShowText ?? true;
}

/**
 * 品牌位是否有可见内容：「侧边栏Logo」（图片，`showLogo`）与「Logo 文字」
 * （标题，`logoShowText`）两个开关相互正交——只关图片时标题仍在，两者都关时
 * 品牌位整体收起（菜单滚动区上移，见 style/sidebar 的 has-logo / no-logo）。
 */
export function resolveBrandVisible(
  configure: ResponsiveStorage["configure"] | undefined
): boolean {
  const showImage = configure?.showLogo ?? true;
  return showImage || resolveLogoTextVisible(configure);
}
