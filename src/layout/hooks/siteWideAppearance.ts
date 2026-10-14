import { getPlatformDefault } from "@/utils/preferences";

/**
 * 站点级外观键（站点标题 / Logo 品牌位 / 登录页布局）：写入系统级配置、全局生效，
 * 仅管理员可改（见 `useSiteWideEdit`）。与后端 `ConfigsViewSet.SITE_WIDE_CONFIG_KEYS`
 * 一一对应，漂移由单测守卫。
 *
 * - `storage`：前端 `configure` 命名空间的存储键（camel）
 * - `config`：服务端字段名（Pascal）
 */
export const SITE_WIDE_APPEARANCE_FIELDS: ReadonlyArray<{
  storage: keyof ResponsiveStorage["configure"];
  config: keyof PlatformConfigs;
}> = [
  { storage: "title", config: "Title" },
  { storage: "showLogo", config: "ShowLogo" },
  { storage: "logoSource", config: "LogoSource" },
  { storage: "logoSourceDark", config: "LogoSourceDark" },
  { storage: "logoShowText", config: "LogoShowText" },
  { storage: "logoFit", config: "LogoFit" },
  { storage: "logoMode", config: "LogoMode" },
  { storage: "fullLogoHeight", config: "FullLogoHeight" },
  { storage: "authPageLayout", config: "AuthPageLayout" }
];

/**
 * 站点级外观的平台默认值（`configure` 存储键 → 值）。
 * 平台配置缺键时跳过该键，避免把 `undefined` 写进本地存储与服务端配置。
 */
export function buildSiteWideAppearanceDefaults(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of SITE_WIDE_APPEARANCE_FIELDS) {
    const value = getPlatformDefault(field.config);
    if (value !== undefined) defaults[field.storage] = value;
  }
  return defaults;
}
