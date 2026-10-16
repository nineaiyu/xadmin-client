import type {
  ScreenFreeLayout,
  ScreenLayoutPane,
  ScreenPaneType
} from "@/api/dataset/analysis";
import { paneBody, type PaneBox } from "./layout";

/**
 * 大屏自由画布（像素级自由排版）的纯几何口径：设计器与投屏共用，
 * 单测见 `__tests__/freeLayout.spec.ts`。
 *
 * 坐标系与服务端 `dataset/utils/screen_layout.py::normalize_screen_free_layout`
 * 一致：x/y 为像素坐标（非负），w/h 为像素尺寸（≥16），以基准设计画幅
 * design_w × design_h 为界（投屏按此等比适配）；**允许重叠**——层级 = 数组顺序
 * （后者在上）。设计器只操作纯数据，落库前由服务端再校验一次；本地这份口径负责
 * 「拖到哪」「缩到多大」「越界夹回」这些交互判断，保证不把必然被拒的载荷发出去。
 */

/** 自由画布窗格数量上限（与服务端 SCREEN_FREE_MAX_PANES 同值；元素更碎，比栅格版放宽） */
export const FREE_MAX_PANES = 60;
/** 窗格最小尺寸（px）：再小已无法呈现内容 */
export const FREE_MIN_PANE_SIZE = 16;
/** 基准设计画幅缺省值与允许范围（px） */
export const FREE_DESIGN_DEFAULTS = { design_w: 1920, design_h: 1080 };
export const FREE_DESIGN_MIN_W = 320;
export const FREE_DESIGN_MAX_W = 7680;
export const FREE_DESIGN_MIN_H = 240;
export const FREE_DESIGN_MAX_H = 4320;

/** 基准设计画幅（纯数据；投屏与设计画布按此定尺寸） */
export type FreeDesign = { design_w: number; design_h: number };

/** 新增窗格的默认尺寸（px，按类型给合理的初始占位） */
export const FREE_PANE_DEFAULTS: Record<
  ScreenPaneType,
  { w: number; h: number }
> = {
  dashboard: { w: 480, h: 320 },
  text: { w: 600, h: 80 },
  clock: { w: 240, h: 120 },
  metric: { w: 240, h: 120 },
  image: { w: 320, h: 240 },
  video: { w: 640, h: 360 },
  html: { w: 640, h: 480 }
};

/** 画幅单边：非有限数值回落缺省，取整后夹在允许范围内 */
function clampDesignSide(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const size = Number(value);
  if (!Number.isFinite(size)) return fallback;
  return Math.min(Math.max(Math.round(size), min), max);
}

/** 归一化设计画幅：缺省 1920×1080，非法值回落缺省并夹在允许范围内 */
export function clampDesign(design?: Partial<FreeDesign> | null): FreeDesign {
  return {
    design_w: clampDesignSide(
      design?.design_w,
      FREE_DESIGN_DEFAULTS.design_w,
      FREE_DESIGN_MIN_W,
      FREE_DESIGN_MAX_W
    ),
    design_h: clampDesignSide(
      design?.design_h,
      FREE_DESIGN_DEFAULTS.design_h,
      FREE_DESIGN_MIN_H,
      FREE_DESIGN_MAX_H
    )
  };
}

/** 把窗格夹回画幅内（px 语义，最小 16×16；越界就地夹回而非拒绝） */
export function clampFreeBox(box: PaneBox, design: FreeDesign): PaneBox {
  const w = Math.min(
    Math.max(Math.round(box.w), FREE_MIN_PANE_SIZE),
    design.design_w
  );
  const h = Math.min(
    Math.max(Math.round(box.h), FREE_MIN_PANE_SIZE),
    design.design_h
  );
  const x = Math.min(Math.max(Math.round(box.x), 0), design.design_w - w);
  const y = Math.min(Math.max(Math.round(box.y), 0), design.design_h - h);
  return { x, y, w, h };
}

/**
 * 指针相对画布的偏移 → 落点盒模型（组件库拖放用）。
 * 落点以指针为左上角，越界夹回画幅（与服务端「越界拒绝」互补：本地先夹，不出现 400）。
 */
export function freeBoxFromOffset(
  offsetX: number,
  offsetY: number,
  size: { w: number; h: number },
  design: FreeDesign
): PaneBox {
  return clampFreeBox({ x: offsetX, y: offsetY, w: size.w, h: size.h }, design);
}

/** 新增窗格的层叠落点：左上起逐个错开，连续点击不叠成一坨 */
export function cascadedBox(
  count: number,
  size: { w: number; h: number },
  design: FreeDesign
): PaneBox {
  const offset = (count % 8) * 24;
  return clampFreeBox({ x: 80 + offset, y: 80 + offset, ...size }, design);
}

/** 落库前清理（自由）：只保留服务端声明键 + 夹回画幅（与服务端归一化同口径） */
export function normalizeFreePanes(
  panes: readonly ScreenLayoutPane[],
  design: FreeDesign
): ScreenLayoutPane[] {
  return panes.map(pane => ({
    ...paneBody(pane),
    ...clampFreeBox(pane, design)
  }));
}

/** 组装自由画布载荷（保存时用）：画幅 + 归一化窗格 */
export function buildFreeLayout(
  panes: readonly ScreenLayoutPane[],
  design: FreeDesign
): ScreenFreeLayout {
  const normalised = clampDesign(design);
  return { ...normalised, panes: normalizeFreePanes(panes, normalised) };
}

/** 读取自由载荷（详情接口）：画幅夹回允许范围、窗格原样（渲染侧只读） */
export function readFreeLayout(raw?: Partial<ScreenFreeLayout> | null): {
  design: FreeDesign;
  panes: ScreenLayoutPane[];
} {
  return {
    design: clampDesign(raw),
    panes: [...(raw?.panes ?? [])]
  };
}
