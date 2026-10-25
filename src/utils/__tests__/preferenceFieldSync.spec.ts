import { type Dirent, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 界面偏好「全链路同步」漂移守卫（静态解析，不 import 业务模块）。
 *
 * 一个「跟随站点配置持久化」的偏好必须同时落到 9 处，漏任何一处都是线上静默事故：
 *   1) `types/global.d.ts` 的 `PlatformConfigs`（服务端字段名，Pascal）
 *   2) `types/global.d.ts` 的 `ResponsiveStorage[...]`（前端字段名，camel）
 *   3) `src/utils/responsive.ts`  注入缺省（platform-config → 本地存储）
 *   4) `src/layout/hooks/useLayout.ts` 本地存储初始化缺省
 *   5) `src/store/modules/siteConfig.ts` 的 `getSiteConfig` 读取映射
 *      —— 漏了会让该偏好在**刷新/换设备后悄悄回退**（面板里改了、重开就没了）
 *   6) `src/store/modules/siteConfig.ts` 的 `saveSiteConfig` 写入映射
 *      —— 漏了会让面板改动**推不到服务端**（只有本机生效）
 *   7) `src/utils/preferenceDiff.ts` 的 `SNAPSHOT_NAMESPACES`（复制偏好为全量快照，
 *      按命名空间整包覆盖：命名字段天然包含，新命名空间才需登记）
 *   8) `public/platform-config.json` 平台默认值
 *   9) `xadmin-server` 的 `systemconfig` 种子（平台层 `loadjson/` + 各 app 的
 *      `seeds/` 层，取并集；单仓检出时此处跳过，其余 8 点仍强制校验）
 *
 * 新增偏好：把 Pascal 名登记到 SERVER_PERSISTED_FIELDS（configure 命名空间）或
 * LAYOUT_PERSISTED_FIELDS（layout 命名空间，如主题色）。
 */

const ROOT = resolve(__dirname, "../../..");
const SERVER_ROOT = resolve(ROOT, "../xadmin-server");

const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/**
 * 跨层发现 systemconfig 种子文件：平台层 `loadjson/` + 各已注册 app 的 `seeds/`
 * （种子按 app 分层后同一模型分布在多个文件，按单文件读取会静默漏行——
 * 与服务端 `read_model_rows` 同口径）。目录不存在（单仓检出）时返回空表。
 */
function discoverSystemconfigSeeds(): string[] {
  if (!existsSync(SERVER_ROOT)) return [];
  const found: string[] = [];
  const platform = join(SERVER_ROOT, "loadjson/systemconfig.json");
  if (existsSync(platform)) found.push(platform);
  let entries: Dirent[];
  try {
    entries = readdirSync(SERVER_ROOT, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(SERVER_ROOT, entry.name, "seeds/systemconfig.json");
    if (existsSync(candidate)) found.push(candidate);
  }
  return found;
}

/** configure 命名空间：随站点配置持久化的界面偏好（服务端字段名） */
const SERVER_PERSISTED_FIELDS = [
  "AuthPageLayout",
  "SidebarWidth",
  "SidebarExpandOnHover",
  "SidebarDraggable",
  "SidebarCollapsedShowTitle",
  "SidebarAutoActivateChild",
  "SidebarAccordion",
  "SidebarCollapseButton",
  "SemiDarkSidebar",
  "SemiDarkHeader",
  "SemiDarkSidebarSub",
  "SuccessColor",
  "WarningColor",
  "DangerColor",
  "HeaderFixed",
  "BreadcrumbVisible",
  "BreadcrumbShowIcon",
  "BreadcrumbShowHome",
  "BreadcrumbHideOnlyOne",
  "BreadcrumbStyle",
  "MaxTagsCount",
  "EnablePreferences",
  "PreferencesPosition",
  "TransitionProgress",
  "TransitionLoading",
  "TagsShowIcon",
  "TagsShowRefresh",
  "TagsShowMore",
  "TagsHeight",
  "TagsKeepAlive",
  "TagsVisitHistory",
  "NavbarSearch",
  "NavbarLanguage",
  "NavbarFullscreen",
  "NavbarLock",
  "NavbarNotice",
  "NavbarRefresh",
  "NavbarSidebarToggle",
  "NavbarThemeToggle",
  "NavbarTimezone",
  "NavbarOrder",
  "NavbarMoreWidgets",
  "HeaderMenuAlign",
  "SidebarCollapseWidth",
  "SidebarMixedWidth",
  "SidebarHidden",
  "SidebarFixedButton",
  "SidebarExtraCollapse",
  "Radius",
  "FontScale",
  "ThemePreset",
  "NavigationStyle",
  "FooterFixed",
  "FooterHeight",
  "LogoSource",
  "LogoShowText",
  "LogoFit",
  "LogoMode",
  "FullLogoHeight",
  "LogoSourceDark",
  "Timezone",
  "NavigationSplit",
  "HeaderMode",
  "HeaderHidden",
  "WidgetPositions",
  "TagsShowMaximize",
  "FontScaleCustom",
  "ShortcutLock",
  "ShortcutSidebar",
  "ShortcutEnable",
  "ShortcutLockKeys",
  "ShortcutSidebarKeys",
  "ShortcutSearchKeys",
  "ShortcutPreferencesKeys",
  "ShortcutLogoutKeys",
  "PreferencesStickyNav",
  "EnableCopyPreferences",
  "Grey",
  "Weak",
  "HideTabs",
  "HideFooter",
  "ShowLogo",
  "TagsStyle",
  "MultiTagsCache",
  "Stretch",
  "HeaderAutoHide",
  "CompactMode",
  "UiSize",
  "TagsMiddleClickClose",
  "TagsWheelSwitch",
  "DynamicTitle",
  "PageTransition",
  "ShortcutSearch"
] as const;

/** layout 命名空间：与导航皮肤/主题色一起持久化的字段 */
const LAYOUT_PERSISTED_FIELDS = ["ThemeColor"] as const;

const camel = (p: string) => p[0].toLowerCase() + p.slice(1);

const typesSource = read("types/global.d.ts");
const platformConfig = JSON.parse(
  read("public/platform-config.json")
) as Record<string, unknown>;
const responsiveSource = read("src/utils/responsive.ts");
// 缺省值构建在 layoutPreferences.ts（useLayout 初始化链路的一部分），两文件合并校验
const useLayoutSource =
  read("src/layout/hooks/useLayout.ts") +
  read("src/layout/hooks/layoutPreferences.ts");
const siteConfigSource = read("src/store/modules/siteConfig.ts");
const diffSource = read("src/utils/preferenceDiff.ts");

/** 复制偏好（全量快照）覆盖的存储命名空间：`SNAPSHOT_NAMESPACES = ["locale", "layout", ...]` */
const snapshotNamespaces = new Set(
  (/SNAPSHOT_NAMESPACES\s*=\s*\[([^\]]*)\]/.exec(diffSource)?.[1] ?? "")
    .match(/"(\w+)"/g)
    ?.map(s => s.slice(1, -1)) ?? []
);

/** PlatformConfigs / ResponsiveStorage 的字段集合（按块提取，避免整文件误命中） */
function declaredKeys(pattern: RegExp): Set<string> {
  const block = pattern.exec(typesSource)?.[1] ?? "";
  return new Set(Array.from(block.matchAll(/^\s*(\w+)\??:/gm)).map(m => m[1]));
}

const platformKeys = declaredKeys(
  /interface PlatformConfigs \{([\s\S]*?)\n\s*\}/
);
const responsiveKeys = declaredKeys(/configure:\s*\{([\s\S]*?)\n\s*\};/);
const layoutKeys = declaredKeys(/\n\s*layout:\s*\{([\s\S]*?)\n\s*\};/);

const seedKeys = (() => {
  const seedFiles = discoverSystemconfigSeeds();
  if (seedFiles.length === 0) return null;
  const keys = new Set<string>();
  for (const file of seedFiles) {
    const rows = JSON.parse(readFileSync(file, "utf-8")) as Array<{
      fields: { key: string; value: unknown };
    }>;
    const row = rows.find(item => item.fields.key === "WEB_SITE_CONFIG");
    if (row && row.fields.value && typeof row.fields.value === "object") {
      for (const key of Object.keys(
        row.fields.value as Record<string, unknown>
      )) {
        keys.add(key);
      }
    }
  }
  return keys;
})();

/** 逐点检查一个字段是否在 9 处都同步（namespace = configure | layout） */
function checkField(pascal: string, namespace: "configure" | "layout") {
  const key = camel(pascal);
  return {
    "types.PlatformConfigs": platformKeys.has(pascal),
    "types.ResponsiveStorage": (namespace === "configure"
      ? responsiveKeys
      : layoutKeys
    ).has(key),
    responsive: new RegExp(`\\b${key}\\b`).test(responsiveSource),
    useLayout: new RegExp(`\\b${key}\\b`).test(useLayoutSource),
    read映射: new RegExp(`\\b${key}:\\s*config\\.${pascal}`).test(
      siteConfigSource
    ),
    write映射: new RegExp(`\\b${pascal}:\\s*${namespace}\\.${key}`).test(
      siteConfigSource
    ),
    preferenceDiff: snapshotNamespaces.has(namespace),
    "platform-config.json": pascal in platformConfig,
    seed: seedKeys === null ? null : seedKeys.has(pascal)
  };
}

describe("界面偏好全链路同步（configure 命名空间）", () => {
  it.each(SERVER_PERSISTED_FIELDS)("%s 已同步到全部落点", pascal => {
    const result = checkField(pascal, "configure");
    for (const [point, ok] of Object.entries(result)) {
      if (ok === null) continue; // 单仓检出：种子文件缺失时跳过该点
      expect(ok, `${pascal} 未同步到 ${point}`).toBe(true);
    }
  });
});

describe("界面偏好全链路同步（layout 命名空间）", () => {
  it.each(LAYOUT_PERSISTED_FIELDS)("%s 已同步到全部落点", pascal => {
    const result = checkField(pascal, "layout");
    for (const [point, ok] of Object.entries(result)) {
      if (ok === null) continue;
      expect(ok, `${pascal} 未同步到 ${point}`).toBe(true);
    }
  });
});
