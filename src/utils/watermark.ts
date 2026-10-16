/**
 * 站点水印工具：配置由服务端「系统设置 → 水印设置」下发，
 * 应用与刷新时机在 `src/App.vue`（按当前路由是否命中生效范围决定挂载/清除），
 * 设置页的实时预览（WatermarkSetting.vue）复用同一套渲染属性。
 *
 * 设计口径：
 * - 文案是**模板**：占位符按当前登录用户解析（见 renderWatermarkText），
 *   留空回落默认模板 `{username}-{nickname}-{time}`；
 * - 生效范围为路由路径前缀列表，空列表 = 全部页面（服务端保存期已校验每项以 / 开头）；
 * - 字号/透明度/旋转角/颜色为站点级样式配置，随用户信息一并下发；
 * - 时间到分钟粒度，页面停留期间每分钟刷新一次（见 App.vue 的定时器）。
 */
import type { SiteWatermarkResultConfig } from "@/api/auth";

/** 站点水印配置（用户信息接口下发） */
export interface SiteWatermarkConfig {
  /** 是否开启站点水印 */
  enabled: boolean;
  /** 文案模板（占位符语法，留空 = 默认模板） */
  template: string;
  /** 生效页面路由路径前缀（空数组 = 全部页面） */
  paths: string[];
  /** 水印字号（像素） */
  fontSize: number;
  /** 水印透明度（0.01-1） */
  opacity: number;
  /** 水印旋转角度（度） */
  rotate: number;
  /** 文字颜色（十六进制/rgba，留空 = 默认灰） */
  color: string;
}

/** useWatermark 的渲染属性（@pureadmin/utils setWatermark 第二参数） */
export interface WatermarkRenderOptions {
  font: string;
  globalAlpha: number;
  rotate: number;
  color?: string;
  verticalOffset: number;
}

/** 服务端缺省值（与 settings_defaults.py 保持一致） */
export const defaultSiteWatermark: SiteWatermarkConfig = {
  enabled: false,
  template: "",
  paths: [],
  fontSize: 16,
  opacity: 0.3,
  rotate: -10,
  color: ""
};

/** 默认文案模板（TEXT 留空时的回落值） */
export const DEFAULT_WATERMARK_TEMPLATE = "{username}-{nickname}-{time}";

/** 文案模板可用的占位符变量（解析自当前登录用户，time 由调用方按分钟刷新） */
export interface WatermarkVars {
  username?: string;
  nickname?: string;
  phone?: string;
  email?: string;
  /** 用户唯一标识 */
  pk?: string | number;
  time?: string;
}

/** 数值兜底：空值/非法值回落默认，并夹在 [min, max] 内 */
function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/** 解析服务端下发的逗号分隔路径配置（容忍中文逗号与空白） */
export function parseWatermarkPaths(raw?: string | null): string[] {
  return String(raw ?? "")
    .split(/[,，]/)
    .map(item => item.trim())
    .filter(Boolean);
}

/** 用户信息接口的 config 载荷 → 站点水印配置（缺省/非法值回落默认） */
export function toSiteWatermarkConfig(
  config?: SiteWatermarkResultConfig
): SiteWatermarkConfig {
  return {
    enabled: !!config?.FRONT_END_WEB_WATERMARK_ENABLED,
    template:
      config?.FRONT_END_WEB_WATERMARK_TEXT ?? defaultSiteWatermark.template,
    paths: parseWatermarkPaths(config?.FRONT_END_WEB_WATERMARK_PATHS),
    fontSize: clampNumber(
      config?.FRONT_END_WEB_WATERMARK_FONT_SIZE,
      defaultSiteWatermark.fontSize,
      8,
      72
    ),
    opacity: clampNumber(
      config?.FRONT_END_WEB_WATERMARK_OPACITY,
      defaultSiteWatermark.opacity,
      0.01,
      1
    ),
    rotate: clampNumber(
      config?.FRONT_END_WEB_WATERMARK_ROTATE,
      defaultSiteWatermark.rotate,
      -90,
      90
    ),
    color: config?.FRONT_END_WEB_WATERMARK_COLOR ?? defaultSiteWatermark.color
  };
}

/**
 * 文案模板渲染：占位符替换为当前用户变量，未知/缺失占位符替换为空串，
 * 由此产生的连续「-」自动合并（默认模板在昵称为空时不再出现双连字符）。
 */
export function renderWatermarkText(
  template: string,
  vars: WatermarkVars
): string {
  const tpl = template?.trim() ? template : DEFAULT_WATERMARK_TEMPLATE;
  return tpl
    .replace(/\{(\w+)\}/g, (raw, key: string) => {
      if (key === "time") return vars.time ?? formatWatermarkTime();
      const value = vars[key as keyof Omit<WatermarkVars, "time">];
      return value === undefined || value === null ? "" : String(value);
    })
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 当前路由是否在站点水印生效范围内（空范围 = 全部页面） */
export function isWatermarkPath(path: string, paths: string[] = []): boolean {
  if (!paths.length) return true;
  return paths.some(prefix => path === prefix || path.startsWith(prefix));
}

/**
 * 站点水印是否应在当前路由展示：
 * 总开关命中 + 非登录页 +（菜单级开关置顶强制 或 命中路径前缀范围）。
 * 菜单级开关来自后端菜单 meta（菜单管理 → 页面水印），是「路径范围」的补充而非替代。
 */
export function isSiteWatermarkVisible(options: {
  enabled: boolean;
  paths?: string[];
  path: string;
  onLoginPage?: boolean;
  menuWatermark?: boolean;
}): boolean {
  const {
    enabled,
    paths = [],
    path,
    onLoginPage = false,
    menuWatermark = false
  } = options;
  if (!enabled || onLoginPage) return false;
  return menuWatermark || isWatermarkPath(path, paths);
}

/** 水印时间戳：YYYY-MM-DD HH:mm（分钟粒度，便于定位泄露时点） */
export function formatWatermarkTime(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 站点水印配置 → useWatermark 渲染属性（font/globalAlpha/rotate/color） */
export function buildWatermarkRenderOptions(
  config: SiteWatermarkConfig
): WatermarkRenderOptions {
  return {
    font: `normal ${config.fontSize}px Arial, 'Courier New', 'Droid Sans', sans-serif`,
    globalAlpha: config.opacity,
    rotate: config.rotate,
    color: config.color || undefined,
    verticalOffset: 170
  };
}
