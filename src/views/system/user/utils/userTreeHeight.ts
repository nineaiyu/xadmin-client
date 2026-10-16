/**
 * UserTree 高度口径：此前散落在模板里的裸 calc 字符串，收敛于此集中管理。
 *
 * 外层容器与滚动区是两个独立调校的盒子，公式不同（容器按 100vh 铺满页面主区、
 * 滚动区按 90vh 预留搜索行/分割线之上的富余），数值不可互相推导——改动任一值
 * 都需要在「用户管理」页同时目检桌面形态与移动端堆叠形态（部门树限高、
 * 用户列表必须留在首屏，见 mobile.e2e 守护）。
 */

/** 桌面形态：外层容器最小高度（layout 主区头部/页签占位约 141px） */
export const DESKTOP_CONTAINER_MIN_HEIGHT = "calc(100vh - 141px)";

/** 桌面形态：部门树滚动区高度（搜索行与分割线位于滚动区上方） */
export const DESKTOP_SCROLL_HEIGHT = "calc(90vh - 108px)";

/** 堆叠（移动端）形态：滚动区自适应且限高，避免树把用户列表推到首屏之外 */
export const COMPACT_SCROLL_HEIGHT = "min(32vh, 260px)";
