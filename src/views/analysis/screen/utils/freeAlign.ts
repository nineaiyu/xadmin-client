import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import {
  FREE_MIN_PANE_SIZE,
  clampFreeBox,
  type FreeDesign
} from "./freeLayout";
import { selectionBounds } from "./freeSelect";
import type { PaneBox } from "./layout";

/**
 * 自由画布的对齐与分布（纯函数 + 单测）：返回 `pk → 新盒模型`，由调用方写回数据
 * 并记一个撤销点。
 *
 * 基准口径：**多选取选区包围盒**，单选取**画幅**（等价「对齐到画布」）；
 * 分布两端极值不动、中间按「边距均分」排布（允许负边距，保证结果确定）；
 * 所有结果夹回画幅（多选时对齐不会把窗格推出画布）。
 */
export const ALIGN_MODES = [
  "left",
  "hcenter",
  "right",
  "top",
  "vcenter",
  "bottom"
] as const;
export type AlignMode = (typeof ALIGN_MODES)[number];

export const DISTRIBUTE_AXES = ["h", "v"] as const;
export type DistributeAxis = (typeof DISTRIBUTE_AXES)[number];

/** 对齐基准：多选 = 选区包围盒，单选 = 整幅画布（左上原点 + 画幅宽高） */
function frameOf(chosen: readonly ScreenLayoutPane[], design: FreeDesign) {
  const bounds =
    chosen.length > 1
      ? selectionBounds(
          chosen,
          chosen.map(pane => pane.pk)
        )
      : null;
  return bounds ?? { x: 0, y: 0, w: design.design_w, h: design.design_h };
}

export function alignBoxes(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  mode: AlignMode,
  design: FreeDesign
): Record<string, PaneBox> {
  const chosen = panes.filter(pane => pks.includes(pane.pk));
  const result: Record<string, PaneBox> = {};
  if (chosen.length === 0) return result;
  const frame = frameOf(chosen, design);
  for (const pane of chosen) {
    const box: PaneBox = { x: pane.x, y: pane.y, w: pane.w, h: pane.h };
    if (mode === "left") box.x = frame.x;
    if (mode === "hcenter") box.x = frame.x + (frame.w - pane.w) / 2;
    if (mode === "right") box.x = frame.x + frame.w - pane.w;
    if (mode === "top") box.y = frame.y;
    if (mode === "vcenter") box.y = frame.y + (frame.h - pane.h) / 2;
    if (mode === "bottom") box.y = frame.y + frame.h - pane.h;
    result[pane.pk] = clampFreeBox(box, design);
  }
  return result;
}

/** 分布（≥3 个才有意义）：两端不动，中间按边距均分 */
export function distributeBoxes(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  axis: DistributeAxis,
  design: FreeDesign
): Record<string, PaneBox> {
  const chosen = panes.filter(pane => pks.includes(pane.pk));
  const result: Record<string, PaneBox> = {};
  if (chosen.length < 3) return result;
  const start = (pane: ScreenLayoutPane) => (axis === "h" ? pane.x : pane.y);
  const size = (pane: ScreenLayoutPane) => (axis === "h" ? pane.w : pane.h);
  const sorted = [...chosen].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + size(last) - start(first);
  const used = sorted.reduce((sum, pane) => sum + size(pane), 0);
  const gap = (span - used) / (sorted.length - 1);
  let cursor = start(first);
  for (const pane of sorted) {
    const box: PaneBox = { x: pane.x, y: pane.y, w: pane.w, h: pane.h };
    if (axis === "h") box.x = cursor;
    else box.y = cursor;
    result[pane.pk] = clampFreeBox(box, design);
    cursor += size(pane) + gap;
  }
  return result;
}

/**
 * 批量对齐网格（多选动作）：把选区内每个窗格的 x / y / w / h 四舍五入到步长倍数
 * （尺寸不小于最小 16px，结果夹回画幅）。已在网格上的窗格不进结果，调用方据此
 * 判断「是否需要记撤销点」——连续点同一个按钮不会堆空历史。
 *
 * 与手势吸附共用同一份网格语义（`freeSnap.FreeGridSnap`）：参考线只在拖动时优先，
 * 这里是显式命令，直接落网格；`step <= 0` 返回空（无网格配置）。
 */
export function snapBoxesToGrid(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  design: FreeDesign,
  step: number
): Record<string, PaneBox> {
  const result: Record<string, PaneBox> = {};
  if (!(step > 0)) return result;
  const round = (value: number) => Math.round(value / step) * step;
  for (const pk of pks) {
    const pane = panes.find(item => item.pk === pk);
    if (!pane) continue;
    const w = Math.max(round(pane.w), FREE_MIN_PANE_SIZE);
    const h = Math.max(round(pane.h), FREE_MIN_PANE_SIZE);
    const box = clampFreeBox(
      {
        x: round(pane.x),
        y: round(pane.y),
        w,
        h
      },
      design
    );
    if (
      box.x !== pane.x ||
      box.y !== pane.y ||
      box.w !== pane.w ||
      box.h !== pane.h
    ) {
      result[pk] = box;
    }
  }
  return result;
}
