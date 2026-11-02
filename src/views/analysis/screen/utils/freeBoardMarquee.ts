import { ref } from "vue";
import { panesInRect, rectFromPoints, type FreeRect } from "./freeSelect";
import { eventToCanvasPoint } from "./freeBoardGeometry";
import type { FreeBoardGestureDeps } from "./freeBoardTypes";

export type FreeMarqueeController = ReturnType<typeof createFreeMarquee>;

/** 框选：空白处拖拽与窗格求交（矩形画在画布坐标系内，随 zoom 一起缩放） */
export function createFreeMarquee(deps: FreeBoardGestureDeps) {
  const marquee = ref<FreeRect | null>(null);
  let marqueeStart: { x: number; y: number; additive: boolean } | null = null;

  const pointAt = (event: PointerEvent) =>
    eventToCanvasPoint(event, deps.canvasRef.value, deps.zoom.value);

  function onCanvasPointerDown(event: PointerEvent) {
    if (!deps.editable.value || event.button !== 0) return;
    const start = pointAt(event);
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
    const point = pointAt(event);
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

  /** 卸载兜底：框选中途切走路由 / 进预览不能留下闭包与事件 */
  function dispose() {
    window.removeEventListener("pointermove", onMarqueeMove);
    window.removeEventListener("pointerup", onMarqueeUp);
    marqueeStart = null;
    marquee.value = null;
  }

  return { marquee, onCanvasPointerDown, dispose };
}
