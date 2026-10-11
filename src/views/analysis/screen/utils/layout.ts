import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import {
  PANE_ANIMATION_DELAY_DEFAULT,
  PANE_ANIMATION_DURATION_DEFAULT,
  clampAnimationMs
} from "./paneEffects";

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

/* ---------------- 画布栅格物理度量（px） ----------------
 * 设计器与投屏页的唯一来源：几何换算（拖拽步长 / drop 落点）与两端画布样式
 * 都从这里派生，杜绝手工双写导致设计预览与投屏逐像素不一致。 */

export const GRID_GAP_X = 12;
export const GRID_GAP_Y = 12;
export const GRID_ROW_HEIGHT = 40;
/** 画布四边内边距：content box 从 padding 之后开始，落点换算要扣掉 */
export const CANVAS_PADDING = 16;

/** 画布栅格样式变量：设计器与投屏的根画布 :style 绑定同一份对象（值随上面常量走） */
export const canvasGridVars: Record<string, string> = {
  "--screen-grid-cols": String(GRID_COLS),
  "--screen-gap-x": `${GRID_GAP_X}px`,
  "--screen-gap-y": `${GRID_GAP_Y}px`,
  "--screen-row-height": `${GRID_ROW_HEIGHT}px`,
  "--screen-canvas-padding": `${CANVAS_PADDING}px`,
  "--screen-row-step": `${GRID_ROW_HEIGHT + GRID_GAP_Y}px`
};

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
 * 栅格像素度量：画布内容宽 → 列步长 / 行步长。
 *
 * 设计器拖拽换算（像素 → 格数）与组件库 drop 落点共用同一份换算，
 * 改动列数 / 行高 / 间距常量时两处不会漂移。
 */
export function gridMetrics(canvasWidth: number): {
  stepX: number;
  stepY: number;
} {
  const content = Math.max(canvasWidth - CANVAS_PADDING * 2, 0);
  const stepX = content > 0 ? (content + GRID_GAP_X) / GRID_COLS : 1;
  return { stepX, stepY: GRID_ROW_HEIGHT + GRID_GAP_Y };
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

/**
 * 图片窗格地址口径：http(s) 绝对地址或站内根相对路径（/ 开头）。
 * `//` 开头的 protocol-relative 地址按外站处理，与服务端口径一致地拒绝。
 * 空值视为「尚未配置」（画布有占位提示），不算非法；属 UX 层行内校验，
 * 保存时服务端仍会再校验一次。
 */
export function isValidPaneImageUrl(url: string | undefined | null): boolean {
  const value = (url ?? "").trim();
  return value.length === 0 || /^(https?:\/\/|\/(?!\/))/i.test(value);
}

/** 窗格公共体（不含坐标段） */
export type PaneBody = Omit<ScreenLayoutPane, "x" | "y" | "w" | "h">;

/**
 * 按类型归一化窗格公共体：只保留服务端声明键并补齐默认值。
 *
 * 栅格与自由画布两套坐标语义共用同一份类型字段规则（与服务端
 * `_normalize_pane_body` 同口径），坐标段由各自调用方按模式处理。
 */
export function paneBody(pane: ScreenLayoutPane): PaneBody {
  const base: PaneBody = {
    pk: pane.pk,
    type: pane.type,
    ...(pane.title ? { title: pane.title } : {})
  };
  // 表达类字段（ADR-088）：非默认才下发——默认值（0 / none / plain）不下发，
  // 既有载荷升级后字节不变，服务端缺省也按同口径补齐
  if (pane.rotate) base.rotate = pane.rotate;
  if (pane.animation && pane.animation !== "none") {
    base.animation = pane.animation;
    // 时序只在配了动画时下发；缺省（320ms / 0ms / 不循环）不写，让 CSS 基线继续生效
    const duration = clampAnimationMs(
      pane.animation_duration,
      PANE_ANIMATION_DURATION_DEFAULT
    );
    const delay = clampAnimationMs(
      pane.animation_delay,
      PANE_ANIMATION_DELAY_DEFAULT
    );
    if (duration !== PANE_ANIMATION_DURATION_DEFAULT) {
      base.animation_duration = duration;
    }
    if (delay > 0) base.animation_delay = delay;
    if (pane.animation_loop) base.animation_loop = true;
  }
  if (pane.type === "dashboard") {
    base.dashboard = pane.dashboard;
  }
  if (pane.type === "text") {
    base.text = pane.text ?? "";
    base.align = pane.align ?? "left";
    base.size = pane.size ?? 24;
    if (pane.text_format === "rich") base.text_format = "rich";
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
}

/** 落库前清理（栅格）：只保留服务端声明键 + 夹回栅格（与服务端归一化同口径） */
export function normalizePanes(
  panes: readonly ScreenLayoutPane[]
): ScreenLayoutPane[] {
  return panes.map(pane => ({ ...paneBody(pane), ...clampBox(pane) }));
}

/** 窗格标识：仅用于定位与列表 key（不落业务语义） */
export function genPaneId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `pane-${random}`
    : `pane-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
