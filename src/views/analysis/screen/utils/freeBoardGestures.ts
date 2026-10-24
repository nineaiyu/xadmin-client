import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { Box } from "@/components/ReResize";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import { FREE_PANE_DEFAULTS, freeBoxFromOffset } from "./freeLayout";
import {
  FREE_SNAP_THRESHOLD,
  snapFreeBox,
  type FreeGridSnap,
  type FreeSnapGuide
} from "./freeSnap";
import {
  panesInRect,
  rectFromPoints,
  selectionBounds,
  type FreeRect
} from "./freeSelect";
import { parsePaletteDrop } from "./dnd";

/** 自由画布手势层向上抛的事件（与 FreeCanvasBoard 的对应 emits 同形） */
export type FreeBoardGestureEmit = {
  (e: "select", payload: { pk: string; additive: boolean }): void;
  (e: "selectMany", payload: { pks: string[]; additive: boolean }): void;
  (e: "groupMove", payload: { pk: string; boxes: Record<string, Box> }): void;
  (
    e: "boxStop",
    payload: { pk: string; box: Box; gesture: "move" | "resize" }
  ): void;
  (
    e: "drop",
    payload: { type: ScreenPaneType; dashboard?: string; box: Box }
  ): void;
};

/** 吸附参考线 / 包围盒的画布内定位样式（纯函数，模板直接用） */
export const guideStyle = (guide: FreeSnapGuide) =>
  guide.axis === "x"
    ? { left: `${guide.position}px` }
    : { top: `${guide.position}px` };

/** 矩形（组包围盒 / 框选）的画布内定位样式（纯函数，模板直接用） */
export const rectStyle = (rect: FreeRect) => ({
  left: `${rect.x}px`,
  top: `${rect.y}px`,
  width: `${rect.w}px`,
  height: `${rect.h}px`
});

/**
 * 自由画布设计区的手势层（自 FreeCanvasBoard 抽出，行数门禁）。
 *
 * 覆盖四类交互，几何在此算好后上抛（组合层只写数据，不重复算几何）：
 * - 窗格按下即选中（`Shift/⌘` 加选/减选）+ ReResize 的 snap 钩子（画幅边界 /
 *   中线 + 其他窗格边框与中性线，命中绘制引导线）；
 * - 组拖动：按「起手快照」统一夹回画幅，整组跟随上抛盒模型；
 * - 框选：空白处拖拽与窗格求交（矩形画在画布坐标系内，随 zoom 一起缩放）；
 * - 组件库拖放：类型 + 画布内落点（px，越界已夹回）。
 */
export function useFreeBoardGestures(deps: {
  panes: ComputedRef<ScreenLayoutPane[]>;
  selection: ComputedRef<string[]>;
  design: ComputedRef<FreeDesign>;
  editable: ComputedRef<boolean>;
  gridSnap: ComputedRef<FreeGridSnap | undefined>;
  zoom: ComputedRef<number>;
  canvasRef: Ref<HTMLElement | undefined>;
  emit: FreeBoardGestureEmit;
}) {
  const guides = ref<FreeSnapGuide[]>([]);
  const marquee = ref<FreeRect | null>(null);
  /** 组拖动起手快照：首次移动时捕获，手势期间不随数据变化（避免夹取累积） */
  let groupStart: {
    pk: string;
    boxes: Record<string, Box>;
    bounds: FreeRect;
  } | null = null;
  let marqueeStart: { x: number; y: number; additive: boolean } | null = null;

  const isChosen = (pk: string) => deps.selection.value.includes(pk);
  const groupMode = computed(() => deps.selection.value.length > 1);
  const groupBounds = computed(() =>
    groupMode.value
      ? selectionBounds(deps.panes.value, deps.selection.value)
      : null
  );

  /** 指针坐标 → 画布内数据坐标（先减画布矩形起点、再除以缩放因子） */
  function toData(event: PointerEvent | DragEvent): { x: number; y: number } {
    const canvas = deps.canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / deps.zoom.value,
      y: (event.clientY - rect.top) / deps.zoom.value
    };
  }

  /** 起手快照：组内各窗格的盒模型 + 选区包围盒（组夹取以此为基准） */
  function snapshot(): { boxes: Record<string, Box>; bounds: FreeRect } {
    const boxes: Record<string, Box> = {};
    for (const pane of deps.panes.value) {
      if (isChosen(pane.pk)) {
        boxes[pane.pk] = { x: pane.x, y: pane.y, w: pane.w, h: pane.h };
      }
    }
    return {
      boxes,
      bounds: selectionBounds(deps.panes.value, deps.selection.value) ?? {
        x: 0,
        y: 0,
        w: 0,
        h: 0
      }
    };
  }

  /** 整组夹取：任何一个成员都不得越出画幅（越界即整组停住） */
  function clampDelta(bounds: FreeRect, dx: number, dy: number) {
    return {
      dx: Math.min(
        Math.max(dx, -bounds.x),
        deps.design.value.design_w - (bounds.x + bounds.w)
      ),
      dy: Math.min(
        Math.max(dy, -bounds.y),
        deps.design.value.design_h - (bounds.y + bounds.h)
      )
    };
  }

  /** 吸附候选 = 其他窗格；组拖动时再按起手快照做整组夹取 */
  const snapFor = (pk: string) => (box: Box, dir: string) => {
    const result = snapFreeBox(
      box,
      deps.panes.value.filter(pane => pane.pk !== pk),
      deps.design.value,
      dir,
      FREE_SNAP_THRESHOLD,
      deps.gridSnap.value,
      // 旋转窗格按视觉盒吸附：把本窗格的旋转角带进去
      deps.panes.value.find(pane => pane.pk === pk)?.rotate ?? 0
    );
    if (dir || !groupMode.value || !isChosen(pk)) return result;
    const start = groupStart ?? (groupStart = { pk, ...snapshot() });
    const anchor = start.boxes[pk];
    if (!anchor) return result;
    const delta = clampDelta(
      start.bounds,
      result.box.x - anchor.x,
      result.box.y - anchor.y
    );
    return {
      box: { ...result.box, x: anchor.x + delta.dx, y: anchor.y + delta.dy },
      guides: result.guides
    };
  };

  const onSnapping = (next: unknown[]) => {
    guides.value = next as FreeSnapGuide[];
  };

  /** 按下即选中：已在选区内保持不动（才能直接整组拖动），Shift/⌘ 为加选/减选 */
  function onPanePointerDown(pk: string, event: PointerEvent) {
    if (!deps.editable.value || event.button !== 0) return;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (additive) {
      deps.emit("select", { pk, additive: true });
      return;
    }
    if (!isChosen(pk)) deps.emit("select", { pk, additive: false });
  }

  function onDragging(pk: string, x: number, y: number) {
    if (!groupMode.value || !isChosen(pk) || groupStart?.pk !== pk) return;
    const anchor = groupStart.boxes[pk];
    if (!anchor) return;
    const delta = clampDelta(groupStart.bounds, x - anchor.x, y - anchor.y);
    const boxes: Record<string, Box> = {};
    for (const [key, box] of Object.entries(groupStart.boxes)) {
      boxes[key] = { ...box, x: box.x + delta.dx, y: box.y + delta.dy };
    }
    deps.emit("groupMove", { pk, boxes });
  }

  function onDeactivated() {
    guides.value = [];
    groupStart = null;
  }

  /* ---------------- 框选 ---------------- */

  function onCanvasPointerDown(event: PointerEvent) {
    if (!deps.editable.value || event.button !== 0) return;
    const start = toData(event);
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    marqueeStart = { ...start, additive };
    if (!additive) deps.emit("select", { pk: "", additive: false });
    marquee.value = rectFromPoints(start.x, start.y, start.x, start.y);
    window.addEventListener("pointermove", onMarqueeMove);
    window.addEventListener("pointerup", onMarqueeUp);
  }

  function onMarqueeMove(event: PointerEvent) {
    if (!marqueeStart) return;
    if (event.buttons === 0) {
      onMarqueeUp();
      return;
    }
    const point = toData(event);
    marquee.value = rectFromPoints(
      marqueeStart.x,
      marqueeStart.y,
      point.x,
      point.y
    );
  }

  function onMarqueeUp() {
    const rect = marquee.value;
    const additive = marqueeStart?.additive ?? false;
    marqueeStart = null;
    marquee.value = null;
    window.removeEventListener("pointermove", onMarqueeMove);
    window.removeEventListener("pointerup", onMarqueeUp);
    // 位移过小视为「点击空白」（清空选中已在按下时完成）
    if (!rect || (rect.w < 4 && rect.h < 4)) return;
    deps.emit("selectMany", {
      pks: panesInRect(deps.panes.value, rect),
      additive
    });
  }

  const onDrop = (event: DragEvent) => {
    const payload = parsePaletteDrop(event);
    const canvas = deps.canvasRef.value;
    if (!payload || !canvas || !deps.editable.value) return;
    const point = toData(event);
    deps.emit("drop", {
      ...payload,
      box: freeBoxFromOffset(
        point.x,
        point.y,
        FREE_PANE_DEFAULTS[payload.type],
        deps.design.value
      )
    });
  };

  return {
    guides,
    marquee,
    groupBounds,
    isChosen,
    snapFor,
    onSnapping,
    onPanePointerDown,
    onDragging,
    onDeactivated,
    onCanvasPointerDown,
    onDrop
  };
}
