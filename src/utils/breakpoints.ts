/**
 * 设计体系断点（JS 侧）：与 src/style/tokens/breakpoints.scss 同源维护。
 *
 * 使用口径：
 * - **视口宽度**判定统一走本模块（或 SCSS 侧 bp mixin），不要在页面里写裸数字；
 * - `deviceDetection()`（@pureadmin/utils）是 **UA 判定**（触屏 / 移动端 UA），
 *   与宽度断点是两个独立维度：移动端形态（抽屉导航、全屏弹窗）用 UA 判定，
 *   布局收缩（侧栏折叠、栅格列数）用宽度断点，两者可以同时成立。
 *
 * 单测（src/utils/breakpoints.spec.ts）会比对两侧数值，防止漂移。
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1600
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/** 视口宽度 ≤ 断点 */
export function isBelow(key: BreakpointKey): boolean {
  return window.innerWidth <= BREAKPOINTS[key];
}

/** 视口宽度 > 断点 */
export function isAbove(key: BreakpointKey): boolean {
  return window.innerWidth > BREAKPOINTS[key];
}

/** 媒体查询串（供 matchMedia 监听）：`(width <= 768px)` */
export function mediaQueryBelow(key: BreakpointKey): string {
  return `(width <= ${BREAKPOINTS[key]}px)`;
}
