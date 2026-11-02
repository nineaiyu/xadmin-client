import type { Box } from "@/components/ReResize";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { selectionBounds, type FreeRect } from "./freeSelect";
import type { FreeDesign } from "./freeLayout";

/** 指针坐标 → 画布内数据坐标（先减画布矩形起点、再除以缩放因子） */
export function eventToCanvasPoint(
  event: PointerEvent | DragEvent,
  canvas: HTMLElement | undefined,
  zoom: number
): { x: number; y: number } {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom
  };
}

/** 起手快照：组内各窗格的盒模型 + 选区包围盒（组夹取以此为基准） */
export function groupSnapshot(
  panes: ScreenLayoutPane[],
  selection: string[]
): { boxes: Record<string, Box>; bounds: FreeRect } {
  const boxes: Record<string, Box> = {};
  for (const pane of panes) {
    if (selection.includes(pane.pk)) {
      boxes[pane.pk] = { x: pane.x, y: pane.y, w: pane.w, h: pane.h };
    }
  }
  return {
    boxes,
    bounds: selectionBounds(panes, selection) ?? { x: 0, y: 0, w: 0, h: 0 }
  };
}

/** 整组夹取：任何一个成员都不得越出画幅（越界即整组停住） */
export function clampGroupDelta(
  bounds: FreeRect,
  design: FreeDesign,
  dx: number,
  dy: number
) {
  return {
    dx: Math.min(
      Math.max(dx, -bounds.x),
      design.design_w - (bounds.x + bounds.w)
    ),
    dy: Math.min(
      Math.max(dy, -bounds.y),
      design.design_h - (bounds.y + bounds.h)
    )
  };
}

/** 按位移平移整组盒模型（保持组内相对位置） */
export function offsetGroupBoxes(
  boxes: Record<string, Box>,
  dx: number,
  dy: number
): Record<string, Box> {
  const next: Record<string, Box> = {};
  for (const [key, box] of Object.entries(boxes)) {
    next[key] = { ...box, x: box.x + dx, y: box.y + dy };
  }
  return next;
}
