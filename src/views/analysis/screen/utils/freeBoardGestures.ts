import { onBeforeUnmount } from "vue";
import type { FreeSnapGuide } from "./freeSnap";
import type { FreeRect } from "./freeSelect";
import { FREE_PANE_DEFAULTS, freeBoxFromOffset } from "./freeLayout";
import { parsePaletteDrop } from "./dnd";
import { eventToCanvasPoint } from "./freeBoardGeometry";
import { createFreeSnapController } from "./freeBoardSnap";
import { createFreeMarquee } from "./freeBoardMarquee";
import type { FreeBoardGestureDeps } from "./freeBoardTypes";

export type { FreeBoardGestureEmit } from "./freeBoardTypes";

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
 *
 * 组合层只接线：吸附 / 组拖动在 freeBoardSnap，框选在 freeBoardMarquee，
 * 几何纯函数在 freeBoardGeometry。
 */
export function useFreeBoardGestures(deps: FreeBoardGestureDeps) {
  const snap = createFreeSnapController(deps);
  const marqueeApi = createFreeMarquee(deps);

  const onDrop = (event: DragEvent) => {
    const payload = parsePaletteDrop(event);
    const canvas = deps.canvasRef.value;
    if (!payload || !canvas || !deps.editable.value) return;
    const point = eventToCanvasPoint(event, canvas, deps.zoom.value);
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

  // 卸载时兜底移除 window 监听：框选中途切走路由/进预览不能留下闭包与事件
  onBeforeUnmount(() => marqueeApi.dispose());

  return {
    guides: snap.guides,
    marquee: marqueeApi.marquee,
    groupBounds: snap.groupBounds,
    isChosen: snap.isChosen,
    snapFor: snap.snapFor,
    onSnapping: snap.onSnapping,
    onPanePointerDown: snap.onPanePointerDown,
    onDragging: snap.onDragging,
    onDeactivated: snap.onDeactivated,
    onCanvasPointerDown: marqueeApi.onCanvasPointerDown,
    onDrop
  };
}
