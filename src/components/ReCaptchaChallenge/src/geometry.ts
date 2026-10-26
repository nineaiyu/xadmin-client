/** 交互式验证码的纯几何 / 映射逻辑（可单测，不依赖 DOM 组件状态）。 */
import { actionOffset } from "@/components/ReSliderCaptcha/src/geometry";

export const SLIDER_ACTION_WIDTH = 40;

export function sliderMax(wrapperWidth: number): number {
  return actionOffset(wrapperWidth, SLIDER_ACTION_WIDTH);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 滑杆位移 -> 拼块自然像素 x（拼块只能横向移动） */
export function moveToPuzzleX(
  moveX: number,
  maxMoveX: number,
  naturalWidth: number,
  pieceSize: number
): number {
  if (maxMoveX <= 0) return 0;
  return clamp(moveX / maxMoveX, 0, 1) * Math.max(naturalWidth - pieceSize, 0);
}

/** 滑杆位移 -> 旋转角（-180° ~ 180°，与后端答案口径一致） */
export function moveToAngle(moveX: number, maxMoveX: number): number {
  if (maxMoveX <= 0) return 0;
  return Math.round(clamp(moveX / maxMoveX, 0, 1) * 360 - 180);
}

/** 显示坐标 -> 题目图片自然像素坐标（响应式缩放后的点击命中换算） */
export function toNaturalPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number } {
  const x =
    rect.width > 0 ? ((clientX - rect.left) / rect.width) * naturalWidth : 0;
  const y =
    rect.height > 0 ? ((clientY - rect.top) / rect.height) * naturalHeight : 0;
  return {
    x: Math.round(clamp(x, 0, naturalWidth)),
    y: Math.round(clamp(y, 0, naturalHeight))
  };
}

/** 旋转角显示归一（CSS rotate 支持负角，展示时归一到 -180~180） */
export function displayAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}
