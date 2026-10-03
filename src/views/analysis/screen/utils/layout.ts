import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";

/**
 * 大屏画布栅格的纯几何口径（设计器与展示端共用，单测见 __tests__/layout.spec.ts）。
 *
 * 坐标系与服务端 `dataset/utils/screen_layout.py` 一致：x 为列下标（0 起，x+w≤12）、
 * y 为行下标（0 起，y+h≤60）。设计器只操作纯数据（box），落库前由服务端再校验一次；
 * 本地这份口径负责「拖到哪一格」「能不能放」「放不下时找哪个空位」这些交互判断，
 * 保证不把必然被拒的载荷发出去（400 弹提示的体验不如就地吸附）。
 */

export const GRID_COLS = 12;
export const GRID_MAX_ROWS = 60;
export const MAX_PANES = 24;

/** 新增窗格的默认尺寸（按类型给合理的初始占位） */
export const PANE_DEFAULTS: Record<ScreenPaneType, { w: number; h: number }> = {
  dashboard: { w: 6, h: 4 },
  text: { w: 12, h: 2 },
  clock: { w: 3, h: 2 },
  metric: { w: 3, h: 2 },
  image: { w: 3, h: 3 }
};

export type PaneBox = Pick<ScreenLayoutPane, "x" | "y" | "w" | "h">;

/** 两个窗格在栅格上是否重叠（边界相接不算） */
export function overlaps(first: PaneBox, second: PaneBox): boolean {
  return !(
    first.x + first.w <= second.x ||
    second.x + second.w <= first.x ||
    first.y + first.h <= second.y ||
    second.y + second.h <= first.y
  );
}

/** 把窗格夹回栅格范围内（拖拽越界时就地吸附而非拒绝） */
export function clampBox(box: PaneBox): PaneBox {
  const w = Math.min(Math.max(Math.round(box.w), 1), GRID_COLS);
  const h = Math.min(Math.max(Math.round(box.h), 1), GRID_MAX_ROWS);
  const x = Math.min(Math.max(Math.round(box.x), 0), GRID_COLS - w);
  const y = Math.min(Math.max(Math.round(box.y), 0), GRID_MAX_ROWS - h);
  return { x, y, w, h };
}

/** 目标位置是否可放（ignoreIndex 用于「移动自身」时跳过自己） */
export function canPlace(
  panes: readonly PaneBox[],
  box: PaneBox,
  ignoreIndex = -1
): boolean {
  const target = clampBox(box);
  return panes.every(
    (pane, index) => index === ignoreIndex || !overlaps(pane, target)
  );
}

/** 行优先扫描首个能容纳 w×h 的空位；放不下返回 null（画布已满） */
export function findSlot(
  panes: readonly PaneBox[],
  w: number,
  h: number
): PaneBox | null {
  const size = clampBox({ x: 0, y: 0, w, h });
  for (let y = 0; y + size.h <= GRID_MAX_ROWS; y += 1) {
    for (let x = 0; x + size.w <= GRID_COLS; x += 1) {
      const box = { x, y, w: size.w, h: size.h };
      if (canPlace(panes, box)) return box;
    }
  }
  return null;
}

/**
 * 指针坐标 → 栅格下标（画布内偏移 + 单元格尺寸；落在 gap 上时归到更近的一侧）。
 */
export function cellFromOffset(
  offsetX: number,
  offsetY: number,
  metrics: { cellW: number; cellH: number; gapX: number; gapY: number }
): { x: number; y: number } {
  const stepX = metrics.cellW + metrics.gapX;
  const stepY = metrics.cellH + metrics.gapY;
  const x = Math.floor((offsetX + metrics.gapX / 2) / stepX);
  const y = Math.floor((offsetY + metrics.gapY / 2) / stepY);
  return {
    x: Math.min(Math.max(x, 0), GRID_COLS - 1),
    y: Math.min(Math.max(y, 0), GRID_MAX_ROWS - 1)
  };
}

/** 落库前清理：只保留服务端声明键，并按类型补齐默认值（与服务端归一化同口径） */
export function normalizePanes(
  panes: readonly ScreenLayoutPane[]
): ScreenLayoutPane[] {
  return panes.map(pane => {
    const box = clampBox(pane);
    const base: ScreenLayoutPane = {
      pk: pane.pk,
      type: pane.type,
      ...box,
      ...(pane.title ? { title: pane.title } : {})
    };
    if (pane.type === "dashboard") {
      base.dashboard = pane.dashboard;
    }
    if (pane.type === "text") {
      base.text = pane.text ?? "";
      base.align = pane.align ?? "left";
      base.size = pane.size ?? 24;
    }
    if (pane.type === "clock") {
      base.size = pane.size ?? 40;
    }
    if (pane.type === "metric") {
      base.dataset = pane.dataset;
      base.metric = pane.metric ?? "count";
      if (base.metric !== "count" && pane.value_field) {
        base.value_field = pane.value_field;
      }
    }
    if (pane.type === "image") {
      base.url = pane.url ?? "";
      base.fit = pane.fit ?? "cover";
    }
    return base;
  });
}

/** 窗格标识：仅用于定位与列表 key（不落业务语义） */
export function genPaneId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `pane-${random}`
    : `pane-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
