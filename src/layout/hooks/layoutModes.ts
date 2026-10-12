/**
 * 布局模式的语义判定与派生（纯函数域，非 `use*` 命名不计入 hook 长度门禁）。
 *
 * xadmin 的 6 种布局模式与 vben 布局矩阵对应：
 * - `vertical`           侧栏 + 顶栏（顶栏在侧栏右侧）—— 对应 vben `sidebar-nav`
 * - `horizontal`         顶栏菜单、无侧栏 —— 对应 vben `header-nav`
 * - `mix`                顶栏一级菜单（位于侧栏右侧）+ 侧栏显示所属一级的子菜单
 * - `sidebar-mixed-nav`  双列侧栏（一级窄列 + 二级展开列），顶栏在侧栏右侧
 * - `header-sidebar-nav` 顶栏通栏（含一级菜单）+ 侧栏显示子菜单
 * - `header-mixed-nav`   顶栏通栏（含一级菜单）+ 双列侧栏
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
  | "header-mixed-nav";

export const LAYOUT_MODES: readonly LayoutMode[] = [
  "vertical",
  "horizontal",
  "mix",
  "sidebar-mixed-nav",
  "header-sidebar-nav",
  "header-mixed-nav"
];

/** 归一化布局标识：未知/空值回落 `vertical` */
export function normalizeLayoutMode(layout: unknown): LayoutMode {
  const value = String(layout ?? "");
  return LAYOUT_MODES.includes(value as LayoutMode)
    ? (value as LayoutMode)
    : "vertical";
}

/** 是否渲染侧栏容器（除水平布局外全部渲染） */
export function hasSidebar(layout: unknown): boolean {
  return normalizeLayoutMode(layout) !== "horizontal";
}

/** 顶栏是否渲染一级菜单条（`mix` 及两种 header 系布局） */
export function hasHeaderMenu(layout: unknown): boolean {
  return (
    normalizeLayoutMode(layout) === "mix" ||
    normalizeLayoutMode(layout) === "header-sidebar-nav" ||
    normalizeLayoutMode(layout) === "header-mixed-nav"
  );
}

/** 顶栏是否通栏（跨越侧栏宽度、占满整宽） */
export function isHeaderFullWidth(layout: unknown): boolean {
  return (
    normalizeLayoutMode(layout) === "horizontal" ||
    normalizeLayoutMode(layout) === "header-sidebar-nav" ||
    normalizeLayoutMode(layout) === "header-mixed-nav"
  );
}

/** 侧栏是否双列（一级窄列 + 二级展开列） */
export function isTwoColumnSidebar(layout: unknown): boolean {
  return (
    normalizeLayoutMode(layout) === "sidebar-mixed-nav" ||
    normalizeLayoutMode(layout) === "header-mixed-nav"
  );
}

/** 侧栏菜单是否收敛为「当前一级路由的子菜单」（竖排外均如此） */
export function isSidebarSubmenu(layout: unknown): boolean {
  const mode = normalizeLayoutMode(layout);
  return hasSidebar(mode) && mode !== "vertical";
}

/**
 * 侧栏是否显示「当前一级路由的子菜单」（运行期判定，含 `navigationSplit` 开关）：
 * - 双列布局与 `header-mixed-nav`：一级导航在窄列 / 顶栏，侧栏恒为子菜单；
 * - `header-sidebar-nav` 与 `mix`：一级导航在顶栏，`navigationSplit` 关时侧栏
 *   回到完整菜单树（对齐 vben `navigation.split`）。
 */
export function sidebarShowsSubmenu(
  layout: unknown,
  navigationSplit: unknown
): boolean {
  const mode = normalizeLayoutMode(layout);
  if (!hasSidebar(mode) || mode === "vertical") return false;
  if (mode === "sidebar-mixed-nav" || mode === "header-mixed-nav") return true;
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
