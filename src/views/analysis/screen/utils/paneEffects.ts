import type { ScreenLayoutPane } from "@/api/dataset/analysis";

/**
 * 窗格「表达」类效果的纯映射：旋转角度与入场动画（单测见 `__tests__/paneEffects.spec.ts`）。
 *
 * 两条口径写死在这里，组件只消费：
 * - **旋转是视觉旋转**，不参与几何（吸附 / 框选 / 对齐仍按轴对齐盒模型），渲染作用在
 *   窗格内容层，且组件内的编辑手柄要反向旋转回来（手柄始终轴对齐才好拖）；
 * - **动画只在展示态播放**（投屏与设计器预览），编辑态不播（避免干扰编辑与吸附判断）。
 */

/** 入场动画取值（与服务端 `SCREEN_ANIMATIONS` 同序同值） */
export const PANE_ANIMATIONS = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "zoom-in"
] as const;

export type PaneAnimation = (typeof PANE_ANIMATIONS)[number];

/** 服务端取值范围（旋转角度，度） */
export const PANE_ROTATE_MIN = -180;
export const PANE_ROTATE_MAX = 180;

/** 角度夹取：非有限值 / 非数按 0 处理（等同不旋转），并四舍五入到整数度 */
export function clampRotate(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(
    Math.max(Math.round(value), PANE_ROTATE_MIN),
    PANE_ROTATE_MAX
  );
}

/** 动画类名：none / 未知值返回空串（调用方据此决定是否挂 class） */
export function paneAnimationClass(name?: string): string {
  if (!name || name === "none") return "";
  return PANE_ANIMATIONS.includes(name as PaneAnimation)
    ? `pane-animation--${name}`
    : "";
}

/** 窗格是否配置了入场动画 */
export function hasPaneAnimation(
  pane: Pick<ScreenLayoutPane, "animation">
): boolean {
  return paneAnimationClass(pane.animation) !== "";
}

/** 动画选项清单（属性面板下拉：值 + i18n 文案 key） */
export function paneAnimationOptions(): {
  value: PaneAnimation;
  label: string;
}[] {
  return PANE_ANIMATIONS.map(value => ({
    value,
    label: `dataScreen.animation${value
      .split("-")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")}`
  }));
}
