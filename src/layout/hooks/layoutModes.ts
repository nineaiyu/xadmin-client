/**
 * 布局模式的语义判定与派生（纯函数域，非 `use*` 命名不计入 hook 长度门禁）。
 *
 * xadmin 的 7 种布局模式（形态语义如下）：
 * - `vertical`           侧栏（Logo + 全树）全高 + 顶栏在侧栏右侧
 * - `sidebar-mixed-nav`  双列侧栏（一级窄列含 Logo + 二级列）全高 + 顶栏在侧栏右侧
 * - `horizontal`         无侧栏，顶栏通栏（Logo + 全树菜单）
 * - `mix`                顶栏通栏（Logo + 一级菜单）+ 侧栏排在顶栏下方（子菜单，受导航切割控制）
 * - `header-sidebar-nav` 顶栏通栏（Logo + 面包屑，无菜单）+ 侧栏排在顶栏下方（全树）
 * - `header-mixed-nav`   双列侧栏（含 Logo）全高 + 顶栏在侧栏右侧（一级菜单）
 * - `full-content`       不渲染侧栏 / 顶栏 / 页签 / 页脚，只显示内容主体
 *
 * 判定函数替代原先散落的 `layout.includes("vertical")` 子串判定——子串判定有
 * 两类事故：`sidebar-mixed-nav` 命中 `includes("mix")` 被误判为混合布局；
 * `header-sidebar-nav` 的 `vertical` / `horizontal` 两个分支都不命中，导致
 * 侧栏与顶栏菜单都不渲染。
 */

export type LayoutMode =
  | "vertical"
  | "horizontal"
  | "mix"
  | "sidebar-mixed-nav"
  | "header-sidebar-nav"
  | "header-mixed-nav"
  | "full-content";

export const LAYOUT_MODES: readonly LayoutMode[] = [
  "vertical",
  "horizontal",
  "mix",
  "sidebar-mixed-nav",
  "header-sidebar-nav",
  "header-mixed-nav",
  "full-content"
];

/** 归一化布局标识：未知/空值回落 `vertical` */
export function normalizeLayoutMode(layout: unknown): LayoutMode {
  const value = String(layout ?? "");
  return LAYOUT_MODES.includes(value as LayoutMode)
    ? (value as LayoutMode)
    : "vertical";
}

/** 是否渲染侧栏容器（水平布局与全屏内容不渲染） */
export function hasSidebar(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return mode !== "horizontal" && mode !== "full-content";
}

/**
 * 侧栏模式：侧栏 + 顶栏共存的五种布局；
 * 水平布局（无侧栏）与全屏内容（无外壳）除外。
 */
export function isSideMode(layout: unknown): boolean {
  return hasSidebar(layout);
}

/** 是否为顶部导航模式 */
export function isHeaderNav(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "horizontal";
}

/** 是否为混合导航模式（顶栏一级菜单 + 侧栏子菜单） */
export function isMixedNav(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "mix";
}

/** 是否为双列侧栏模式 */
export function isSidebarMixedNav(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "sidebar-mixed-nav";
}

/** 是否为顶部通栏 + 侧边导航模式 */
export function isHeaderSidebarNav(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "header-sidebar-nav";
}

/** 是否为顶部混合双列模式 */
export function isHeaderMixedNav(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "header-mixed-nav";
}

/**
 * 是否为全屏内容模式：不渲染侧栏 / 顶栏 / 页签 / 页脚，
 * 只显示内容主体。
 */
export function isFullContent(layout: unknown): boolean {
  return normalizeLayoutMode(layout) === "full-content";
}

/**
 * 顶栏是否渲染水平菜单：
 * - `horizontal`：顶栏承载完整菜单树（NavHorizontal 自带渲染）；
 * - `mix` / `header-mixed-nav`：顶栏渲染一级菜单条（NavMix）。
 * `header-sidebar-nav` 的顶栏只有面包屑与动作区，不在此列。
 */
export function hasHeaderMenu(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return mode === "horizontal" || mode === "mix" || mode === "header-mixed-nav";
}

/**
 * 顶栏容器内是否内嵌一级菜单条（混合系布局）。
 * 与 `hasHeaderMenu` 的差别：水平布局的一级菜单由通栏顶栏组件自行渲染。
 */
export function hasNavbarMenu(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return mode === "mix" || mode === "header-mixed-nav";
}

/**
 * Logo 是否归属顶栏：侧栏排在顶栏下方的
 * 混合系布局没有「侧栏顶部品牌区」，Logo 随顶栏展示（消费侧在顶栏隐藏时
 * 由侧栏 Logo 兜底，避免品牌位整体消失）。
 */
export function hasNavbarLogo(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return mode === "mix" || mode === "header-sidebar-nav";
}

/** 顶栏是否通栏（跨越侧栏宽度、占满整宽） */
export function isHeaderFullWidth(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return (
    mode === "horizontal" || mode === "mix" || mode === "header-sidebar-nav"
  );
}

/** 侧栏是否双列（一级窄列 + 二级展开列） */
export function isTwoColumnSidebar(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return mode === "sidebar-mixed-nav" || mode === "header-mixed-nav";
}

/**
 * 侧栏是否显示「当前一级路由的子菜单」（运行期判定，含 `navigationSplit` 开关）：
 * - 双列布局与 `header-mixed-nav`：一级导航在窄列 / 顶栏，侧栏恒为子菜单；
 * - `mix`：一级导航在顶栏，`navigationSplit` 关时侧栏回到完整菜单树
 *   （导航切割开关）；
 * - `header-sidebar-nav`：一级导航在侧栏（全树），不做切割。
 */
export function sidebarShowsSubmenu(
  layout: unknown,
  navigationSplit: unknown
): boolean {
  const mode = normalizeLayoutMode(layout);
  if (!hasSidebar(mode) || mode === "vertical") return false;
  if (mode === "sidebar-mixed-nav" || mode === "header-mixed-nav") return true;
  if (mode === "header-sidebar-nav") return false;
  return Boolean(navigationSplit);
}

/** 移动端强制回落竖排（顶栏与双列侧栏在窄屏下不可用） */
export function resolveLayoutMode(
  layout: unknown,
  isMobile: boolean
): LayoutMode {
  return isMobile ? "vertical" : normalizeLayoutMode(layout);
}

/** 顶栏模式四态：static（随内容滚动）/ fixed / auto / auto-scroll */
export type HeaderMode = "static" | "fixed" | "auto" | "auto-scroll";

/** 由顶栏模式派生「固定顶栏」：仅 `static` 为非固定 */
export function headerModeToFixed(mode: unknown): boolean {
  return String(mode ?? "fixed") !== "static";
}

/** 由顶栏模式派生「滚动自动隐藏」：`auto` / `auto-scroll` 两态开启 */
export function headerModeToAutoHide(mode: unknown): boolean {
  const value = String(mode ?? "fixed");
  return value === "auto" || value === "auto-scroll";
}

/**
 * 顶栏模式的归一化：偏好 `headerMode` 为空时，由历史布尔键
 * （`headerFixed` / `headerAutoHide`）推导，保证存量用户的顶栏行为不因
 * 新增四态偏好而回退。
 */
export function resolveHeaderMode(
  mode: unknown,
  legacyFixed: unknown,
  legacyAutoHide: unknown
): HeaderMode {
  const value = String(mode ?? "");
  if (
    value === "static" ||
    value === "fixed" ||
    value === "auto" ||
    value === "auto-scroll"
  ) {
    return value;
  }
  if (legacyFixed === false) return "static";
  return legacyAutoHide === true ? "auto" : "fixed";
}
