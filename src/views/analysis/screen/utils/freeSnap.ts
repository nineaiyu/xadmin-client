import type { FreeDesign } from "./freeLayout";
import { FREE_MIN_PANE_SIZE } from "./freeLayout";
import type { PaneBox } from "./layout";

/**
 * 自由画布的吸附参考线（纯函数，单测见 `__tests__/freeSnap.spec.ts`）。
 *
 * 拖动 / 缩放时，窗格的边框与中性线在阈值内吸附到「其他窗格的边框与中性线 +
 * 画幅边界与中线」；命中后返回吸附后的盒模型与参考线集合，画布按 axis/position
 * 绘制引导线。实现接缝 = `ReResize` 的 `snap` 钩子（组件只做手势与几何），
 * 业务吸附规则留在这里，组件通用性不被污染。
 */

/** 吸附阈值（px）：超过该距离不吸附（保留自由摆放的手感） */
export const FREE_SNAP_THRESHOLD = 4;

/** 元素级网格吸附的步长档位（px）与缺省值（ADR-088，默认关闭） */
export const FREE_GRID_STEPS = [2, 4, 8, 10, 16, 20];
export const FREE_GRID_DEFAULT_STEP = 8;

/** 网格吸附配置：`step <= 0` 视为关闭（缺省 = 关闭，行为与一期完全一致） */
export type FreeGridSnap = { enabled: boolean; step: number };

/** 参考线：axis=x 为竖线（position 为画布内 x 坐标），axis=y 为横线 */
export type FreeSnapGuide = { axis: "x" | "y"; position: number };

export type FreeSnapResult = { box: PaneBox; guides: FreeSnapGuide[] };

/** 单轴候选线：画幅边界与中线 + 其他窗格的边框与中心线 */
function axisTargets(
  axis: "x" | "y",
  others: readonly PaneBox[],
  design: FreeDesign
): number[] {
  const size = axis === "x" ? design.design_w : design.design_h;
  const targets = [0, size / 2, size];
  for (const pane of others) {
    const start = axis === "x" ? pane.x : pane.y;
    const length = axis === "x" ? pane.w : pane.h;
    targets.push(start, start + length / 2, start + length);
  }
  return targets;
}

/** 在阈值内挑最接近的对齐位移（`hit=false` 表示没命中参考线，保持原状） */
function bestDelta(
  anchors: readonly number[],
  targets: readonly number[],
  threshold: number
): { delta: number; hit: boolean } {
  let best = 0;
  let hit = false;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    for (const target of targets) {
      const distance = Math.abs(target - anchor);
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        best = target - anchor;
        hit = true;
      }
    }
  }
  return { delta: best, hit };
}

/**
 * 单轴吸附位移：**参考线优先、网格兜底**。
 *
 * 命中参考线（含「本来就对齐」的 0 距离）就用参考线位移——否则网格会把已经贴好的
 * 窗格拽离参考线；没命中才落网格（四舍五入到步长倍数）。网格关闭时退化为纯参考线
 * 位移，与一期行为逐字节一致。
 */
function axisDelta(
  anchors: readonly number[],
  primary: number,
  targets: readonly number[],
  threshold: number,
  grid?: FreeGridSnap
): number {
  const guide = bestDelta(anchors, targets, threshold);
  if (guide.hit) return guide.delta;
  const step = grid?.enabled ? grid.step : 0;
  if (!(step > 0)) return 0;
  return Math.round(primary / step) * step - primary;
}

/** 吸附后命中的参考线：盒模型任一边或中心线落在候选线上即命中 */
function hitGuides(
  axis: "x" | "y",
  box: PaneBox,
  targets: readonly number[]
): FreeSnapGuide[] {
  const anchors =
    axis === "x"
      ? [box.x, box.x + box.w / 2, box.x + box.w]
      : [box.y, box.y + box.h / 2, box.y + box.h];
  const guides: FreeSnapGuide[] = [];
  for (const target of targets) {
    if (
      anchors.some(anchor => Math.abs(anchor - target) < 0.5) &&
      !guides.some(guide => guide.position === target)
    ) {
      guides.push({ axis, position: target });
    }
  }
  return guides;
}

/**
 * 吸附候选盒模型。
 *
 * `dir` 为空 = 拖动（三锚点整体吸附，位置变化、尺寸不变）；否则为缩放方位
 * （tl/tm/tr/mr/br/bm/bl/ml，只吸附被拖动的那条边，对边保持不动），
 * 缩放后仍不小于最小尺寸，否则放弃该轴吸附。
 *
 * `grid` 为元素级网格吸附（ADR-088）：**参考线优先、网格兜底**，两轴独立判定；
 * 缺省不传 = 行为与一期完全一致（只吸附参考线）。
 */
export function snapFreeBox(
  box: PaneBox,
  others: readonly PaneBox[],
  design: FreeDesign,
  dir = "",
  threshold = FREE_SNAP_THRESHOLD,
  grid?: FreeGridSnap
): FreeSnapResult {
  const xTargets = axisTargets("x", others, design);
  const yTargets = axisTargets("y", others, design);
  let next: PaneBox = { ...box };

  if (!dir) {
    next = {
      ...next,
      x:
        next.x +
        axisDelta(
          [box.x, box.x + box.w / 2, box.x + box.w],
          box.x,
          xTargets,
          threshold,
          grid
        ),
      y:
        next.y +
        axisDelta(
          [box.y, box.y + box.h / 2, box.y + box.h],
          box.y,
          yTargets,
          threshold,
          grid
        )
    };
  } else {
    if (dir.includes("l")) {
      const x = box.x + axisDelta([box.x], box.x, xTargets, threshold, grid);
      const w = box.x + box.w - x;
      if (w >= FREE_MIN_PANE_SIZE) next = { ...next, x, w };
    } else if (dir.includes("r")) {
      const w =
        box.w +
        axisDelta([box.x + box.w], box.x + box.w, xTargets, threshold, grid);
      if (w >= FREE_MIN_PANE_SIZE) next = { ...next, w };
    }
    if (dir.includes("t")) {
      const y = box.y + axisDelta([box.y], box.y, yTargets, threshold, grid);
      const h = box.y + box.h - y;
      if (h >= FREE_MIN_PANE_SIZE) next = { ...next, y, h };
    } else if (dir.includes("b")) {
      const h =
        box.h +
        axisDelta([box.y + box.h], box.y + box.h, yTargets, threshold, grid);
      if (h >= FREE_MIN_PANE_SIZE) next = { ...next, h };
    }
  }

  return {
    box: next,
    guides: [
      ...hitGuides("x", next, xTargets),
      ...hitGuides("y", next, yTargets)
    ]
  };
}
