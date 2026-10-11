import type { Ref } from "vue";
import type { ScreenPaneType } from "@/api/dataset/analysis";
import {
  CANVAS_PADDING,
  GRID_GAP_X,
  GRID_GAP_Y,
  GRID_ROW_HEIGHT,
  PANE_DEFAULTS,
  cellFromOffset,
  type PaneBox
} from "./layout";

/**
 * 组件库 → 画布的 HTML5 拖放：payload 走自定义 MIME，避免与文件/文本拖放串扰；
 * 落点先换算成栅格 cell（content box 从 padding 之后开始），可放则就地落格，
 * 否则回落 addPane 的自动找位。
 */

const PALETTE_MIME = "application/x-screen-pane";

export interface PalettePayload {
  type: ScreenPaneType;
  dashboard?: string;
}

/** 组件库条目 dragstart：携带窗格类型（仪表盘类附加 pk） */
export function onPaletteDragStart(
  event: DragEvent,
  type: ScreenPaneType,
  dashboard?: string
) {
  event.dataTransfer?.setData(
    PALETTE_MIME,
    JSON.stringify({ type, dashboard })
  );
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

/** 解析 drop 事件携带的组件库 payload（非本组件库来源时返回 null） */
export function parsePaletteDrop(event: DragEvent): PalettePayload | null {
  const raw = event.dataTransfer?.getData(PALETTE_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PalettePayload;
  } catch {
    return null;
  }
}

export function createCanvasDropHandler({
  canvasRef,
  metrics,
  addPane
}: {
  canvasRef: Ref<HTMLElement | undefined>;
  metrics: () => { stepX: number; stepY: number };
  addPane: (type: ScreenPaneType, dashboard?: string, at?: PaneBox) => void;
}) {
  return (event: DragEvent) => {
    const payload = parsePaletteDrop(event);
    if (!payload) return;
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { stepX } = metrics();
    const size = PANE_DEFAULTS[payload.type];
    const cell = cellFromOffset(
      event.clientX - rect.left - CANVAS_PADDING,
      event.clientY - rect.top - CANVAS_PADDING,
      {
        cellW: stepX - GRID_GAP_X,
        cellH: GRID_ROW_HEIGHT,
        gapX: GRID_GAP_X,
        gapY: GRID_GAP_Y
      }
    );
    addPane(payload.type, payload.dashboard, {
      x: cell.x,
      y: cell.y,
      w: size.w,
      h: size.h
    });
  };
}
