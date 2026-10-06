import { onBeforeUnmount, type Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { canPlace, clampBox, type PaneBox } from "./layout";

/**
 * 画布拖拽 / 缩放手势（pointer 事件驱动）。
 *
 * 按住起点先算「格数增量」再夹回栅格；落点与其他窗格重叠时**保持原位**
 * （不弹错），拖回可放区域即继续跟随。撤销点在**实际位移超过阈值后**才记
 * （按下未动的手势不产生空撤销点；同一手势只记一个，连续步进由 history
 * 的 coalesceKey 合并）。
 */

/** 实际位移超过该阈值（px）才记撤销点：过滤按下瞬间的抖动与未移动的点击 */
const MOVE_PUSH_THRESHOLD_PX = 1;

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
        pk: string;
        /** 本手势是否已记撤销点（位移达标的首个 pointermove 记，之后不再记） */
        pushed: boolean;
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
    dragState = {
      mode,
      index,
      pk,
      pushed: false,
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
    // 位移达标才记撤销点（快照必须在布局变更前），未达标直接忽略本次移动
    if (!dragState.pushed) {
      const moved = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY
      );
      if (moved <= MOVE_PUSH_THRESHOLD_PX) return;
      dragState.pushed = true;
      pushHistory(`drag-${dragState.pk}-${dragState.mode}`);
    }
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
