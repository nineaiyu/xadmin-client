import type { Component } from "vue";

import NavbarSidebarToggle from "./NavbarSidebarToggle.vue";
import NavbarRefresh from "./NavbarRefresh.vue";
import NavbarSearch from "./NavbarSearch.vue";
import NavbarLanguage from "./NavbarLanguage.vue";
import NavbarFullscreen from "./NavbarFullscreen.vue";
import NavbarThemeToggle from "./NavbarThemeToggle.vue";
import NavbarLock from "./NavbarLock.vue";
import NavbarNotice from "./NavbarNotice.vue";
import NavbarTimezone from "./NavbarTimezone.vue";

/**
 * 顶栏组件目录（设置面板 →「布局」→「顶栏组件」的数据源）。
 *
 * - `visibleKey` / `defaultVisible`：沿用各组件既有的显隐开关与缺省值；
 * - `more`：是否可收进「更多」下拉——弹层类组件（搜索 / 语言 / 全屏 / 通知）
 *   在下拉里无法正常展开弹层，固定顶栏；
 * - 顺序由偏好 `navbarOrder` 控制（缺省即本目录顺序）；
 * - 落位由偏好 `widgetPositions` 控制（顶栏 / 更多 / 头像下拉 / 不显示），
 *   未登记时回落各组件既有显隐开关与 `navbarMoreWidgets`。
 */
export interface NavbarWidgetItem {
  key: string;
  labelKey: string;
  component: Component;
  visibleKey: keyof ResponsiveStorage["configure"];
  defaultVisible: boolean;
  more: boolean;
}

export const NAVBAR_WIDGETS: NavbarWidgetItem[] = [
  {
    key: "sidebarToggle",
    labelKey: "layout.navbarSidebarToggle",
    component: NavbarSidebarToggle,
    visibleKey: "navbarSidebarToggle",
    defaultVisible: false,
    more: true
  },
  {
    key: "refresh",
    labelKey: "layout.navbarRefresh",
    component: NavbarRefresh,
    visibleKey: "navbarRefresh",
    defaultVisible: true,
    more: true
  },
  {
    key: "search",
    labelKey: "layout.navbarSearch",
    component: NavbarSearch,
    visibleKey: "navbarSearch",
    defaultVisible: true,
    more: false
  },
  {
    key: "language",
    labelKey: "buttons.language",
    component: NavbarLanguage,
    visibleKey: "navbarLanguage",
    defaultVisible: true,
    more: false
  },
  {
    key: "fullscreen",
    labelKey: "layout.navbarFullscreen",
    component: NavbarFullscreen,
    visibleKey: "navbarFullscreen",
    defaultVisible: true,
    more: false
  },
  {
    key: "themeToggle",
    labelKey: "layout.navbarThemeToggle",
    component: NavbarThemeToggle,
    visibleKey: "navbarThemeToggle",
    defaultVisible: false,
    more: true
  },
  {
    key: "lock",
    labelKey: "layout.navbarLock",
    component: NavbarLock,
    visibleKey: "navbarLock",
    defaultVisible: true,
    more: true
  },
  {
    key: "notice",
    labelKey: "layout.navbarNotice",
    component: NavbarNotice,
    visibleKey: "navbarNotice",
    defaultVisible: true,
    more: false
  },
  {
    key: "timezone",
    labelKey: "layout.navbarTimezone",
    component: NavbarTimezone,
    visibleKey: "navbarTimezone",
    defaultVisible: false,
    more: true
  }
];

/** 内置顺序（= 目录顺序；偏好 `navbarOrder` 缺省时使用） */
export const DEFAULT_NAVBAR_ORDER: string[] = NAVBAR_WIDGETS.map(
  item => item.key
);

/** 可收进「更多」下拉的组件键（设置面板位置选项的候选） */
export const NAVBAR_MORE_KEYS: string[] = NAVBAR_WIDGETS.filter(
  item => item.more
).map(item => item.key);

export function findNavbarWidget(key: string): NavbarWidgetItem | undefined {
  return NAVBAR_WIDGETS.find(item => item.key === key);
}

/** 顶栏组件落位：顶栏 / 更多下拉 / 头像下拉 / 不显示 */
export type WidgetPosition = "header" | "more" | "user-dropdown" | "none";

export const WIDGET_POSITIONS: readonly WidgetPosition[] = [
  "header",
  "more",
  "user-dropdown",
  "none"
];

function isWidgetPosition(value: unknown): value is WidgetPosition {
  return WIDGET_POSITIONS.includes(value as WidgetPosition);
}

/**
 * 单个组件的落位（纯函数）：
 * 1) `widgetPositions[key]` 显式登记优先；
 * 2) 未登记时回落历史键——显隐开关关闭即 `none`，在 `navbarMoreWidgets` 内
 *    且可收纳即 `more`，否则 `header`。
 */
export function resolveWidgetPosition(
  key: string,
  configure: Record<string, unknown> | undefined
): WidgetPosition {
  const item = findNavbarWidget(key);
  if (!item) return "none";
  const config = configure ?? {};
  const positions = config.widgetPositions as
    Record<string, unknown> | undefined;
  const explicit = positions?.[key];
  if (isWidgetPosition(explicit)) {
    // 弹层类组件（more=false）登记为 more 时按顶栏处理：下拉里无法正常展开弹层，
    // 且偏好可由任意客户端写入，不能只靠面板侧过滤
    return explicit === "more" && !item.more ? "header" : explicit;
  }

  const visible =
    (config[item.visibleKey] as boolean | undefined) ?? item.defaultVisible;
  if (!visible) return "none";
  const more = Array.isArray(config.navbarMoreWidgets)
    ? (config.navbarMoreWidgets as unknown[])
    : [];
  return item.more && more.includes(key) ? "more" : "header";
}

/** 顶栏组件编排结果：三组共用同一序号空间（`order` 落成 flex order） */
export interface NavbarWidgetLayout {
  header: Array<{ item: NavbarWidgetItem; order: number }>;
  more: Array<{ item: NavbarWidgetItem; order: number }>;
  userDropdown: Array<{ item: NavbarWidgetItem; order: number }>;
}

/**
 * 固定元素（「更多」下拉 / 设置齿轮 / 用户下拉）的 flex order：必须**恒在**
 * 组件序号空间（0..N，见 resolveNavbarLayout）右侧——缺省 order=0 会与首个
 * 组件的序号相同，导致用户下拉被挤到动作区中段（历史缺陷）。
 */
export const NAVBAR_FIXED_ORDER = {
  more: 9000,
  preferences: 9001,
  userDropdown: 9002
} as const;

/**
 * 依据偏好计算顶栏组件编排（纯函数，供顶栏渲染与单测）：
 * - 顺序：`navbarOrder`（缺省内置顺序；未知键忽略，未登记的组件按内置顺序补在末尾）；
 * - 落位：`widgetPositions`（缺省回落历史显隐开关与 `navbarMoreWidgets`）。
 */
export function resolveNavbarLayout(
  configure: Record<string, unknown> | undefined
): NavbarWidgetLayout {
  const config = configure ?? {};
  const configured = Array.isArray(config.navbarOrder)
    ? (config.navbarOrder as unknown[]).filter(
        (key): key is string => typeof key === "string"
      )
    : [];
  const order = [
    ...configured.filter(key => Boolean(findNavbarWidget(key))),
    ...DEFAULT_NAVBAR_ORDER.filter(key => !configured.includes(key))
  ];

  const entries = order
    .map(key => ({
      item: findNavbarWidget(key),
      position: resolveWidgetPosition(key, config)
    }))
    .filter(
      (entry): entry is { item: NavbarWidgetItem; position: WidgetPosition } =>
        Boolean(entry.item) && entry.position !== "none"
    )
    // 序号在可见集合内连续（落成 flex order，无需携带被隐藏项的占位）
    .map((entry, index) => ({ ...entry, order: index }));

  return {
    header: entries.filter(entry => entry.position === "header"),
    more: entries.filter(entry => entry.position === "more"),
    userDropdown: entries.filter(entry => entry.position === "user-dropdown")
  };
}
