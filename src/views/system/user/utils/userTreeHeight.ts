/**
 * UserTree 高度口径：此前散落在模板里的裸 calc 字符串，收敛于此集中管理。
 *
 * 外层容器与滚动区是两个独立调校的盒子，公式不同（容器按视口铺满页面主区、
 * 滚动区按 90vh 预留搜索行/分割线之上的富余），数值不可互相推导——改动任一值
 * 都需要在「用户管理」页同时目检桌面形态与移动端堆叠形态（部门树限高、
 * 用户列表必须留在首屏，见 mobile.e2e 守护）。
 *
 * 布局让位统一消费外壳写入的 --layout-chrome-h（顶栏 + 页签 + 模拟横幅总高，
 * 跟随「隐藏页签 / 隐藏顶栏」等偏好自适应，替代按默认 chrome 校准的 141px 魔数）；
 * 全部取值以完整 style 字符串承载——vh/dvh 双写依赖 CSS 级联（后者覆盖前者，
 * 不支持 dvh 的旧浏览器回落 vh，全站惯例见 lay-content / sidebar）。
 */

/** 桌面形态：外层容器最小高度。chrome 之外再让 50px（app-main 内边距与
    页面自有留白的合成值，页面私有）；默认 chrome 91px 时与旧口径
    calc(100vh - 141px) 逐像素一致（91 + 50 = 141），偏好切换后自适应 */
export const DESKTOP_CONTAINER_MIN_HEIGHT =
  "min-height: calc(100vh - var(--layout-chrome-h) - 50px);min-height: calc(100dvh - var(--layout-chrome-h) - 50px)";

/** 桌面形态：部门树滚动区高度（搜索行与分割线位于滚动区上方，108px 为其让位） */
export const DESKTOP_SCROLL_HEIGHT =
  "height: calc(90vh - 108px);height: calc(90dvh - 108px)";

/** 堆叠（移动端）形态：滚动区自适应且限高，避免树把用户列表推到首屏之外 */
export const COMPACT_SCROLL_HEIGHT =
  "height: min(32vh, 260px);height: min(32dvh, 260px)";
