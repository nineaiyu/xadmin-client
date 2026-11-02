import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { clampFreeBox, type FreeDesign } from "./freeLayout";
import { clampGroupDelta } from "./freeSelect";
import { nudgeCoalesceKey } from "./history";
import type { FreeBoxApi, FreeBoxMap } from "./freeEditorBoxApi";
import type { PaneBox } from "./layout";

export type FreeGestureApi = ReturnType<typeof createFreeGestures>;

/**
 * 自由画布手势 → 数据落点（组拖动 / 单格停手 / 键盘微调）。
 *
 * 几何夹取在画布板完成，这里只负责「写数据 + 撤销点时机」：整组一次撤销点、
 * 位移为 0 不记点。
 */
export function createFreeGestures(deps: {
  panes: Ref<ScreenLayoutPane[]>;
  design: Ref<FreeDesign>;
  selection: Ref<string[]>;
  pushHistory: (key?: string) => void;
  markDirty: () => void;
  boxApi: FreeBoxApi;
}) {
  /** 本手势是否已记撤销点（组拖动首次移动时记，停手不重复记） */
  let gestureTouched = false;

  function ensureHistory(key: string) {
    if (gestureTouched) return;
    gestureTouched = true;
    deps.pushHistory(key);
  }

  /** 组拖动：整组跟随锚点（几何夹取在画布板完成），写数据但不单独记撤销点 */
  function onGroupMove(payload: { pk: string; boxes: FreeBoxMap }) {
    ensureHistory(`drag-${payload.pk}-group`);
    deps.boxApi.writeBoxes(payload.boxes);
    deps.markDirty();
  }

  /** 手势停手：位移为 0 不记撤销点；组拖动已有撤销点时不再补记 */
  function onBoxStop(payload: {
    pk: string;
    box: PaneBox;
    gesture: "move" | "resize";
  }) {
    const index = deps.panes.value.findIndex(pane => pane.pk === payload.pk);
    if (index >= 0) {
      const current = deps.panes.value[index];
      const box = clampFreeBox(payload.box, deps.design.value);
      if (
        box.x !== current.x ||
        box.y !== current.y ||
        box.w !== current.w ||
        box.h !== current.h
      ) {
        ensureHistory(`drag-${payload.pk}-${payload.gesture}`);
        deps.panes.value[index] = { ...current, ...box };
      }
    }
    gestureTouched = false;
  }

  /** 键盘微调：整组同口径位移（组统一夹取，已在边界不记撤销点） */
  function nudge(dx: number, dy: number, shift: boolean): boolean {
    const pks = deps.selection.value;
    if (pks.length === 0) return false;
    const step = shift ? 10 : 1;
    const delta = clampGroupDelta(
      deps.panes.value,
      pks,
      dx * step,
      dy * step,
      deps.design.value
    );
    if (delta.dx === 0 && delta.dy === 0) return false;
    deps.pushHistory(nudgeCoalesceKey(pks.join(","), false));
    for (const pk of pks) {
      const index = deps.panes.value.findIndex(pane => pane.pk === pk);
      if (index < 0) continue;
      const pane = deps.panes.value[index];
      deps.panes.value[index] = {
        ...pane,
        x: pane.x + delta.dx,
        y: pane.y + delta.dy
      };
    }
    return true;
  }

  return { onGroupMove, onBoxStop, nudge };
}
