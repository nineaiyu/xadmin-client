import { computed, ref } from "vue";
import type { Box } from "@/components/ReResize";
import {
  FREE_SNAP_THRESHOLD,
  snapFreeBox,
  type FreeSnapGuide
} from "./freeSnap";
import {
  clampGroupDelta,
  groupSnapshot,
  offsetGroupBoxes
} from "./freeBoardGeometry";
import { selectionBounds } from "./freeSelect";
import type { FreeBoardGestureDeps } from "./freeBoardTypes";

export type FreeSnapController = ReturnType<typeof createFreeSnapController>;

/**
 * 吸附 / 组拖动控制器：窗格按下选中 + ReResize 的 snap 钩子 + 组拖动整组平移。
 *
 * 几何在 freeBoardGeometry 里算好（起手快照 / 整组夹取 / 平移），这里只负责
 * 交互状态（引导线、组起手快照）与上抛。
 */
export function createFreeSnapController(deps: FreeBoardGestureDeps) {
  const guides = ref<FreeSnapGuide[]>([]);
  /** 组拖动起手快照：首次移动时捕获，手势期间不随数据变化（避免夹取累积） */
  let groupStart: (ReturnType<typeof groupSnapshot> & { pk: string }) | null =
    null;

  const isChosen = (pk: string) => deps.selection.value.includes(pk);
  const groupMode = computed(() => deps.selection.value.length > 1);
  const groupBounds = computed(() =>
    groupMode.value
      ? selectionBounds(deps.panes.value, deps.selection.value)
      : null
  );

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
    const delta = clampGroupDelta(
      start.bounds,
      deps.design.value,
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
    const delta = clampGroupDelta(
      groupStart.bounds,
      deps.design.value,
      x - anchor.x,
      y - anchor.y
    );
    deps.emit("groupMove", {
      pk,
      boxes: offsetGroupBoxes(groupStart.boxes, delta.dx, delta.dy)
    });
  }

  function onDeactivated() {
    guides.value = [];
    groupStart = null;
  }

  function snapshot() {
    return groupSnapshot(deps.panes.value, deps.selection.value);
  }

  return {
    guides,
    groupBounds,
    isChosen,
    snapFor,
    onSnapping,
    onPanePointerDown,
    onDragging,
    onDeactivated
  };
}
