import type { FreeDesign } from "./freeLayout";

/**
 * 自由画布「显示缩放」（viewport zoom）的纯换算：档位、夹取、适应窗口、
 * `Ctrl/⌘ + 滚轮` 的指针锚点补偿（单测见 `__tests__/viewport.spec.ts`）。
 *
 * 口径：zoom **只影响显示与指针换算**，不进入数据、保存载荷与服务端校验。
 * 画布以 `transform: scale(z)`（origin 左上）渲染，外层 stage 的占位尺寸随 z 变化，
 * 否则滚动条不会覆盖缩放后的真实范围（表现为「放大后滚不到右下角」）。
 */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;
/** 档位（工具条下拉与滚轮步进共用） */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
/** 画布在视口内的固定留白（px，不参与缩放）：stage padding 与锚点换算共用一处 */
export const ZOOM_VIEWPORT_PADDING = 16;

/** 视口滚动状态 + 指针位置（锚点补偿的输入） */
export type ZoomViewport = {
  scrollLeft: number;
  scrollTop: number;
  pointerX: number;
  pointerY: number;
};

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX);
}

/** 适应窗口：按容器实测尺寸取较小比例，向下取整到 1%（避免取整后溢出容器） */
export function fitZoom(
  viewW: number,
  viewH: number,
  design: FreeDesign
): number {
  if (design.design_w <= 0 || design.design_h <= 0) return 1;
  const usableW = Math.max(viewW - ZOOM_VIEWPORT_PADDING * 2, 1);
  const usableH = Math.max(viewH - ZOOM_VIEWPORT_PADDING * 2, 1);
  const raw = Math.min(usableW / design.design_w, usableH / design.design_h);
  return clampZoom(Math.floor(raw * 100) / 100);
}

/** 档位步进（滚轮上下）：命中档位则跳相邻档，非档位值（适应窗口算出）取方向侧最近档 */
export function stepZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.findIndex(step => Math.abs(step - current) < 0.001);
  if (index >= 0) {
    const next = Math.min(
      Math.max(index + direction, 0),
      ZOOM_STEPS.length - 1
    );
    return ZOOM_STEPS[next];
  }
  const candidates =
    direction > 0
      ? ZOOM_STEPS.filter(step => step > current + 0.001)
      : ZOOM_STEPS.filter(step => step < current - 0.001).reverse();
  return clampZoom(candidates[0] ?? current);
}

/**
 * 指针锚点缩放：缩放前后保持指针下的**数据点**不动，返回补偿后的滚动位置。
 * 画布在 stage 内偏移 `ZOOM_VIEWPORT_PADDING`，换算需一并计入。
 */
export function anchorScroll(
  from: number,
  to: number,
  viewport: ZoomViewport
): { scrollLeft: number; scrollTop: number } {
  const dataX =
    (viewport.scrollLeft + viewport.pointerX - ZOOM_VIEWPORT_PADDING) / from;
  const dataY =
    (viewport.scrollTop + viewport.pointerY - ZOOM_VIEWPORT_PADDING) / from;
  return {
    scrollLeft: Math.max(
      dataX * to + ZOOM_VIEWPORT_PADDING - viewport.pointerX,
      0
    ),
    scrollTop: Math.max(
      dataY * to + ZOOM_VIEWPORT_PADDING - viewport.pointerY,
      0
    )
  };
}
