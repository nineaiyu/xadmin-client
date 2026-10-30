import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";

/**
 * 站点/个人偏好键的单一注册表（save ↔ get ↔ 默认值同源）。
 *
 * 历史实现是两张 ~100 键的手工映射表（saveSiteConfig 的「本地 key → 服务端
 * 扁平大写键」与 getSiteConfig 的「服务端键 → 本地 key + 缺省值」）。新增一个
 * 偏好键要同时改五处，漏一处就是「改了不生效/刷新回退」，故收敛为本表：
 * 新增键只在这里加一行，save/get 与默认值自动派生。
 *
 * 行格式：[服务端 PlatformConfigs 键, 本地 key, 缺省值]；缺省值可写成函数，
 * 依赖其它服务端键（如 ThemeColor 回落 Theme）。
 */
export type PreferenceSection = "locale" | "layout" | "configure";

export interface PreferenceField {
  /** 服务端 PlatformConfigs 的扁平键 */
  serverKey: string;
  /** 本地响应式存储命名空间 */
  section: PreferenceSection;
  /** 本地 key */
  localKey: string;
  /** 服务端缺该键时的缺省值（函数形态可依赖其它服务端键） */
  defaultValue: unknown | ((config: Record<string, unknown>) => unknown);
}

type PreferenceRow = [
  serverKey: string,
  localKey: string,
  defaultValue: PreferenceField["defaultValue"]
];

const LOCALE_FIELDS: PreferenceRow[] = [["Locale", "locale", "zh"]];

const LAYOUT_FIELDS: PreferenceRow[] = [
  ["Layout", "layout", "vertical"],
  ["Theme", "theme", "light"],
  [
    "ThemeColor",
    "themeColor",
    (config: Record<string, unknown>) => config.Theme ?? "light"
  ],
  ["DarkMode", "darkMode", false],
  ["SidebarStatus", "sidebarStatus", true],
  ["EpThemeColor", "epThemeColor", DEFAULT_EP_THEME_COLOR],
  ["ThemeMode", "themeMode", "light"]
];

const CONFIGURE_FIELDS: PreferenceRow[] = [
  ["AuthPageLayout", "authPageLayout", "panel-left"],
  ["Grey", "grey", false],
  ["Weak", "weak", false],
  ["HideTabs", "hideTabs", false],
  ["HideFooter", "hideFooter", false],
  ["FooterFixed", "footerFixed", false],
  ["FooterHeight", "footerHeight", 0],
  ["Title", "title", ""],
  ["ShowLogo", "showLogo", true],
  ["LogoSource", "logoSource", ""],
  ["LogoShowText", "logoShowText", true],
  ["LogoFit", "logoFit", "contain"],
  ["LogoMode", "logoMode", "icon"],
  ["FullLogoHeight", "fullLogoHeight", 32],
  ["LogoSourceDark", "logoSourceDark", ""],
  ["Timezone", "timezone", ""],
  ["TagsStyle", "tagsStyle", "chrome"],
  ["MultiTagsCache", "multiTagsCache", false],
  ["Stretch", "stretch", false],
  ["HeaderAutoHide", "headerAutoHide", false],
  ["CompactMode", "compactMode", false],
  ["UiSize", "uiSize", "default"],
  ["Radius", "radius", "default"],
  ["FontScale", "fontScale", "default"],
  ["FontScaleCustom", "fontScaleCustom", 14],
  ["ThemePreset", "themePreset", "default"],
  ["NavigationStyle", "navigationStyle", "rounded"],
  ["NavigationSplit", "navigationSplit", true],
  ["SidebarAccordion", "sidebarAccordion", true],
  ["SidebarCollapseButton", "sidebarCollapseButton", true],
  ["SemiDarkSidebar", "semiDarkSidebar", false],
  ["SemiDarkHeader", "semiDarkHeader", false],
  ["SemiDarkSidebarSub", "semiDarkSidebarSub", false],
  ["SuccessColor", "successColor", ""],
  ["WarningColor", "warningColor", ""],
  ["DangerColor", "dangerColor", ""],
  ["SidebarWidth", "sidebarWidth", 224],
  ["SidebarExpandOnHover", "sidebarExpandOnHover", true],
  ["SidebarDraggable", "sidebarDraggable", false],
  ["SidebarCollapsedShowTitle", "sidebarCollapsedShowTitle", false],
  ["SidebarAutoActivateChild", "sidebarAutoActivateChild", false],
  ["HeaderFixed", "headerFixed", true],
  ["HeaderMode", "headerMode", ""],
  ["HeaderHidden", "headerHidden", false],
  ["BreadcrumbVisible", "breadcrumbVisible", true],
  ["BreadcrumbShowIcon", "breadcrumbShowIcon", true],
  ["BreadcrumbShowHome", "breadcrumbShowHome", false],
  ["BreadcrumbHideOnlyOne", "breadcrumbHideOnlyOne", false],
  ["BreadcrumbStyle", "breadcrumbStyle", "normal"],
  ["MaxTagsCount", "maxTagsCount", 0],
  ["NavbarSearch", "navbarSearch", true],
  ["NavbarLanguage", "navbarLanguage", true],
  ["NavbarFullscreen", "navbarFullscreen", true],
  ["NavbarLock", "navbarLock", true],
  ["NavbarNotice", "navbarNotice", true],
  ["NavbarRefresh", "navbarRefresh", true],
  ["NavbarSidebarToggle", "navbarSidebarToggle", false],
  ["NavbarThemeToggle", "navbarThemeToggle", false],
  ["NavbarTimezone", "navbarTimezone", false],
  ["NavbarOrder", "navbarOrder", []],
  ["NavbarMoreWidgets", "navbarMoreWidgets", []],
  ["WidgetPositions", "widgetPositions", {}],
  ["HeaderMenuAlign", "headerMenuAlign", "start"],
  ["SidebarCollapseWidth", "sidebarCollapseWidth", 60],
  ["SidebarMixedWidth", "sidebarMixedWidth", 0],
  ["SidebarHidden", "sidebarHidden", false],
  ["SidebarFixedButton", "sidebarFixedButton", false],
  ["SidebarExtraCollapse", "sidebarExtraCollapse", false],
  ["TagsMiddleClickClose", "tagsMiddleClickClose", true],
  ["TagsWheelSwitch", "tagsWheelSwitch", true],
  ["TagsShowIcon", "tagsShowIcon", true],
  ["TagsShowRefresh", "tagsShowRefresh", true],
  ["TagsShowMore", "tagsShowMore", true],
  ["TagsShowMaximize", "tagsShowMaximize", false],
  ["TagsHeight", "tagsHeight", 38],
  ["TagsKeepAlive", "tagsKeepAlive", true],
  ["TagsVisitHistory", "tagsVisitHistory", true],
  ["DynamicTitle", "dynamicTitle", true],
  ["EnablePreferences", "enablePreferences", true],
  ["PreferencesPosition", "preferencesPosition", "header"],
  ["PreferencesStickyNav", "preferencesStickyNav", true],
  ["EnableCopyPreferences", "enableCopyPreferences", true],
  ["PageTransition", "pageTransition", "fade-transform"],
  ["TransitionProgress", "transitionProgress", true],
  ["TransitionLoading", "transitionLoading", false],
  ["ShortcutSearch", "shortcutSearch", true],
  ["ShortcutLock", "shortcutLock", true],
  ["ShortcutSidebar", "shortcutSidebar", true],
  ["ShortcutEnable", "shortcutEnable", true],
  ["ShortcutLockKeys", "shortcutLockKeys", "alt+l"],
  ["ShortcutSidebarKeys", "shortcutSidebarKeys", "alt+s"],
  ["ShortcutSearchKeys", "shortcutSearchKeys", "mod+k"],
  ["ShortcutPreferencesKeys", "shortcutPreferencesKeys", "mod+,"],
  ["ShortcutLogoutKeys", "shortcutLogoutKeys", ""]
];

export const PREFERENCE_FIELDS: readonly PreferenceField[] = [
  ...LOCALE_FIELDS.map(
    ([serverKey, localKey, defaultValue]): PreferenceField => ({
      serverKey,
      section: "locale",
      localKey,
      defaultValue
    })
  ),
  ...LAYOUT_FIELDS.map(
    ([serverKey, localKey, defaultValue]): PreferenceField => ({
      serverKey,
      section: "layout",
      localKey,
      defaultValue
    })
  ),
  ...CONFIGURE_FIELDS.map(
    ([serverKey, localKey, defaultValue]): PreferenceField => ({
      serverKey,
      section: "configure",
      localKey,
      defaultValue
    })
  )
];

export interface PreferenceSections {
  locale: Record<string, unknown>;
  layout: Record<string, unknown>;
  configure: Record<string, unknown>;
}

function resolveDefault(
  field: PreferenceField,
  config: Record<string, unknown>
): unknown {
  return typeof field.defaultValue === "function"
    ? (field.defaultValue as (value: Record<string, unknown>) => unknown)(
        config
      )
    : field.defaultValue;
}

/** 服务端扁平配置 → 本地存储三段，缺键回落注册表缺省值。 */
export function localPreferenceSections(
  config: Record<string, unknown>
): PreferenceSections {
  const sections: PreferenceSections = {
    locale: {},
    layout: {},
    configure: {}
  };
  for (const field of PREFERENCE_FIELDS) {
    const value = config[field.serverKey] ?? resolveDefault(field, config);
    sections[field.section][field.localKey] = value;
  }
  return sections;
}

/** 本地存储三段 → 服务端扁平配置（保持注册表顺序；不修改入参）。 */
export function serverPreferenceConfig(
  sections: PreferenceSections
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of PREFERENCE_FIELDS) {
    config[field.serverKey] = sections[field.section][field.localKey];
  }
  return config;
}
