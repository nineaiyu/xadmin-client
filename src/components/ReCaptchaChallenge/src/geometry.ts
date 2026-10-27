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

/**
 * 拼块布局：视觉位移与提交答案必须同源。
 *
 * 用户看到拼块在 `leftPx` 处，提交的答案就是该位置换算回自然像素的
 * `answerX`（`leftPx / scale`）。若两者分别用「滑条 px」与「自然 px」
 * 两套映射，容器宽度与滑条宽度不等时按视觉对齐的答案会偏移 6%~12%，
 * 超过后端 4px 容差——滑动拼图在大部分位置必失败。
 */
export function pieceGeometry(
  moveX: number,
  maxMoveX: number,
  naturalWidth: number,
  pieceSize: number,
  stageWidth: number
): { answerX: number; leftPx: number; scale: number } {
  const answerX = moveToPuzzleX(moveX, maxMoveX, naturalWidth, pieceSize);
  const scale = naturalWidth > 0 ? stageWidth / naturalWidth : 0;
  return { answerX, leftPx: answerX * scale, scale };
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
