import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import type { PaneBox } from "./layout";
import { rectIntersectsPane, rotatedBounds } from "./paneGeometry";

/**
 * 自由画布多选的几何口径：框选命中、选区包围盒、组位移夹取（纯函数 + 单测）。
 *
 * 坐标系与窗格数据一致（设计画布 px）：框选矩形由指针坐标换算而来（先减画布
 * `getBoundingClientRect()` 起点、再除以 zoom），因此本模块不感知 zoom。
 */
export type FreeRect = { x: number; y: number; w: number; h: number };

/** 两点归一到正矩形（框选允许任意方向拖动） */
export function rectFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number
): FreeRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(ax - bx),
    h: Math.abs(ay - by)
  };
}

/**
 * 框选矩形与窗格是否相交。
 *
 * 未旋转窗格 = 轴对齐重叠判定（边界相接不算，与历史一致）；
 * **旋转窗格按旋转矩形做 SAT 相交**（框选看真正覆盖到的像素）。
 */
export function rectHitsPane(
  rect: FreeRect,
  pane: PaneBox,
  rotate = 0
): boolean {
  if (rotate) return rectIntersectsPane(rect, pane, rotate);
  return (
    pane.x < rect.x + rect.w &&
    pane.x + pane.w > rect.x &&
    pane.y < rect.y + rect.h &&
    pane.y + pane.h > rect.y
  );
}

/** 框选命中的窗格 pk（保持数组顺序 = 层级顺序） */
export function panesInRect(
  panes: readonly ScreenLayoutPane[],
  rect: FreeRect
): string[] {
  return panes
    .filter(pane => rectHitsPane(rect, pane, pane.rotate ?? 0))
    .map(pane => pane.pk);
}

/** 选区包围盒（空选区返回 null） */
export function selectionBounds(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[]
): FreeRect | null {
  const chosen = panes.filter(pane => pks.includes(pane.pk));
  if (chosen.length === 0) return null;
  // 视觉盒（旋转窗格取外接 AABB）：对齐 / 分布 / 组夹取都以「看得见的边界」为准
  const boxes = chosen.map(pane =>
    rotatedBounds(
      { x: pane.x, y: pane.y, w: pane.w, h: pane.h },
      pane.rotate ?? 0
    )
  );
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const bottom = Math.max(...boxes.map(box => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * 组位移的统一夹取：任何一个成员都不得越出画幅（越界即整组停住）——
 * 逐格夹取会出现「一个成员贴边、其余继续动」的撕扯。
 */
export function clampGroupDelta(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  dx: number,
  dy: number,
  design: FreeDesign
): { dx: number; dy: number } {
  const bounds = selectionBounds(panes, pks);
  if (!bounds) return { dx, dy };
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
