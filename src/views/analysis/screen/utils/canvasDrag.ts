import { onBeforeUnmount, type Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { canPlace, clampBox, type PaneBox } from "./layout";

/**
 * 画布拖拽 / 缩放手势（pointer 事件驱动）。
 *
 * 按住起点先算「格数增量」再夹回栅格；落点与其他窗格重叠时**保持原位**
 * （不弹错），拖回可放区域即继续跟随。手势开始记一个撤销点（连续步进
 * 由 history 的 coalesceKey 合并）。
 */
export function useCanvasDrag({
  panes,
  selectedPk,
  markDirty,
  metrics,
  pushHistory
}: {
  panes: Ref<ScreenLayoutPane[]>;
  selectedPk: Ref<string>;
  markDirty: () => void;
  /** 栅格度量（列/行的像素步长），与画布样式里的 gap / 行高保持一致 */
  metrics: () => { stepX: number; stepY: number };
  pushHistory: (key?: string) => void;
}) {
  let dragState:
    | {
        mode: "move" | "resize";
        index: number;
        startBox: PaneBox;
        startX: number;
        startY: number;
      }
    | undefined;

  function startTracking(
    mode: "move" | "resize",
    pk: string,
    event: PointerEvent
  ) {
    const index = panes.value.findIndex(pane => pane.pk === pk);
    if (index < 0) return;
    const { x, y, w, h } = panes.value[index];
    pushHistory(`drag-${pk}-${mode}`);
    dragState = {
      mode,
      index,
      startBox: { x, y, w, h },
      startX: event.clientX,
      startY: event.clientY
    };
    selectedPk.value = pk;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopPointerTracking);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragState) return;
    const { stepX, stepY } = metrics();
    const dx = Math.round((event.clientX - dragState.startX) / stepX);
    const dy = Math.round((event.clientY - dragState.startY) / stepY);
    const { startBox, index, mode } = dragState;
    const next =
      mode === "move"
        ? clampBox({ ...startBox, x: startBox.x + dx, y: startBox.y + dy })
        : clampBox({ ...startBox, w: startBox.w + dx, h: startBox.h + dy });
    // 落点非法（与其他窗格重叠）时保持原位：拖回可放区域即继续跟随，无需重按
    if (!canPlace(panes.value, next, index)) return;
    panes.value[index] = { ...panes.value[index], ...next };
    markDirty();
  }

  function stopPointerTracking() {
    dragState = undefined;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopPointerTracking);
  }

  onBeforeUnmount(stopPointerTracking);

  return { startTracking };
}
