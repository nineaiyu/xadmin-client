import type { Component } from "vue";

import NavbarSidebarToggle from "./NavbarSidebarToggle.vue";
import NavbarRefresh from "./NavbarRefresh.vue";
import NavbarSearch from "./NavbarSearch.vue";
import NavbarLanguage from "./NavbarLanguage.vue";
import NavbarFullscreen from "./NavbarFullscreen.vue";
import NavbarThemeToggle from "./NavbarThemeToggle.vue";
import NavbarLock from "./NavbarLock.vue";
import NavbarNotice from "./NavbarNotice.vue";

/**
 * 顶栏组件目录（设置面板 →「布局」→「顶栏组件」的数据源）。
 *
 * - `visibleKey` / `defaultVisible`：沿用各组件既有的显隐开关与缺省值；
 * - `more`：是否可收进「更多」下拉——弹层类组件（搜索 / 语言 / 全屏 / 通知）
 *   在下拉里无法正常展开弹层，固定顶栏；
 * - 顺序由偏好 `navbarOrder` 控制（缺省即本目录顺序）。
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

/** 顶栏组件编排结果：`order` 为渲染序（落成 flex order），header / more 两组共用同一序号空间 */
export interface NavbarWidgetLayout {
  header: Array<{ item: NavbarWidgetItem; order: number }>;
  more: Array<{ item: NavbarWidgetItem; order: number }>;
}

/**
 * 依据偏好计算顶栏组件编排（纯函数，供顶栏渲染与单测）：
 * - 顺序：`navbarOrder`（缺省内置顺序；未知键忽略，未登记的组件按内置顺序补在末尾）；
 * - 位置：`navbarMoreWidgets` 内的动作类组件收进「更多」下拉；
 * - 显隐：各组件既有开关（`visibleKey`），关闭即不进任何一组。
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
  const more = Array.isArray(config.navbarMoreWidgets)
    ? (config.navbarMoreWidgets as unknown[]).filter(
        (key): key is string => typeof key === "string"
      )
    : [];

  const entries = order
    .map(key => findNavbarWidget(key))
    .filter((item): item is NavbarWidgetItem => Boolean(item))
    .filter(
      item =>
        (config[item.visibleKey] as boolean | undefined) ?? item.defaultVisible
    )
    .map((item, index) => ({ item, order: index }));

  return {
    header: entries.filter(
      entry => !(entry.item.more && more.includes(entry.item.key))
    ),
    more: entries.filter(
      entry => entry.item.more && more.includes(entry.item.key)
    )
  };
}
