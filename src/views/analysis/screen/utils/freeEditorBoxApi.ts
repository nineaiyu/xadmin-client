import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import {
  alignBoxes,
  distributeBoxes,
  snapBoxesToGrid,
  type AlignMode,
  type DistributeAxis
} from "./freeAlign";
import type { PaneBox } from "./layout";
import type { FreeGridSnap } from "./freeSnap";

export type FreeBoxMap = Record<string, PaneBox>;

export type FreeBoxApi = ReturnType<typeof createFreeBoxApi>;

/** 批量盒模型写入 / 对齐 / 分布 / 对齐网格（无实际变化时不记撤销点） */
export function createFreeBoxApi(deps: {
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  design: Ref<FreeDesign>;
  gridSnap: Ref<FreeGridSnap>;
  pushHistory: (key?: string) => void;
}) {
  function writeBoxes(map: FreeBoxMap) {
    for (const [pk, box] of Object.entries(map)) {
      const index = deps.panes.value.findIndex(pane => pane.pk === pk);
      if (index >= 0) {
        deps.panes.value[index] = { ...deps.panes.value[index], ...box };
      }
    }
  }

  /** 批量改坐标：无实际变化时不记撤销点（连续点同一个对齐按钮不会堆空历史） */
  function applyBoxes(map: FreeBoxMap, key: string): number {
    const changed = Object.entries(map).filter(([pk, box]) => {
      const pane = deps.panes.value.find(item => item.pk === pk);
      if (!pane) return false;
      return (
        pane.x !== box.x ||
        pane.y !== box.y ||
        pane.w !== box.w ||
        pane.h !== box.h
      );
    });
    if (changed.length === 0) return 0;
    deps.pushHistory(key);
    writeBoxes(Object.fromEntries(changed));
    return changed.length;
  }

  const align = (mode: AlignMode): number =>
    applyBoxes(
      alignBoxes(
        deps.panes.value,
        deps.selection.value,
        mode,
        deps.design.value
      ),
      `align-${mode}-${deps.selection.value.join(",")}`
    );

  const distribute = (axis: DistributeAxis): number =>
    applyBoxes(
      distributeBoxes(
        deps.panes.value,
        deps.selection.value,
        axis,
        deps.design.value
      ),
      `distribute-${axis}-${deps.selection.value.join(",")}`
    );

  /** 批量对齐网格：坐标与尺寸都落到当前步长倍数（已在网格上 = 不产生变更） */
  const alignToGrid = (): number =>
    applyBoxes(
      snapBoxesToGrid(
        deps.panes.value,
        deps.selection.value,
        deps.design.value,
        deps.gridSnap.value.step
      ),
      `grid-${deps.selection.value.join(",")}`
    );

  return { writeBoxes, applyBoxes, align, distribute, alignToGrid };
}
