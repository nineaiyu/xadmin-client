import type { Ref } from "vue";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { createFreePaneOps } from "./freePaneOps";
import { batchCoalesceKey, batchUpdateTargets } from "./freeBatchUpdate";
import { moveSelectionLayer } from "./freeEditorActions";
import type { FreeLayerAction } from "./freePaneOps";
import type { PaneBox } from "./layout";

export type FreePaneCollectionApi = ReturnType<typeof createFreePaneCollection>;

/**
 * 窗格集合级操作（增删 / 属性更新 / 多选批量改属性）。
 *
 * 单格语义归 `freePaneOps`；这里只补「选区与组合层语义」——删除时同步移出
 * 选区、批量写入只针对适用类型且整批只记一个撤销点。
 */
export function createFreePaneCollection(deps: {
  ops: ReturnType<typeof createFreePaneOps>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  pushHistory: (key?: string) => void;
  markDirty: () => void;
}) {
  const addPane = (type: ScreenPaneType, dashboard?: string) =>
    deps.ops.addPane(type, dashboard);

  /** 组件库拖放：类型 + 落点（可放则就地落格，否则回落空位） */
  const onDrop = (payload: {
    type: ScreenPaneType;
    dashboard?: string;
    box: PaneBox;
  }) => deps.ops.addPane(payload.type, payload.dashboard, payload.box);

  /** 删除单个窗格：同步把它从选区移出（选中不归 paneOps 管） */
  function removePk(pk: string) {
    deps.ops.removePane(pk);
    deps.selection.value = deps.selection.value.filter(item => item !== pk);
  }

  function removeSelected(): number {
    const pks = [...deps.selection.value];
    if (pks.length === 0) return 0;
    if (pks.length === 1) {
      removePk(pks[0]);
      return 1;
    }
    deps.pushHistory();
    deps.panes.value = deps.panes.value.filter(pane => !pks.includes(pane.pk));
    deps.selection.value = [];
    return pks.length;
  }

  const updatePane = (patch: Partial<ScreenLayoutPane>) =>
    deps.ops.updatePane(patch);

  /**
   * 批量改属性（多选）：**统一值语义**——同一个值写给选区里「该字段适用」的窗格，
   * 一次操作一个撤销点；不适用的跳过、值没变化的跳过（规则与适用性在 freeBatchUpdate）。
   */
  function updateMany(patch: Partial<ScreenLayoutPane>): number {
    const targets = batchUpdateTargets(
      deps.panes.value,
      deps.selection.value,
      patch
    );
    const keys = Object.keys(targets);
    if (keys.length === 0) return 0;
    deps.pushHistory(
      batchCoalesceKey(
        Object.keys(patch).sort(),
        deps.selection.value.filter(pk => keys.includes(pk))
      )
    );
    for (const pk of keys) {
      const index = deps.panes.value.findIndex(pane => pane.pk === pk);
      if (index >= 0) deps.panes.value[index] = targets[pk];
    }
    deps.markDirty();
    return keys.length;
  }

  /** 层级：单选走 freePaneOps；多选按选区整体置顶 / 置底 / 上移 / 下移一位 */
  const moveLayer = (action: FreeLayerAction) =>
    moveSelectionLayer(
      {
        panes: deps.panes,
        selection: deps.selection,
        moveSingle: deps.ops.moveLayer,
        pushHistory: deps.pushHistory
      },
      action
    );

  return {
    addPane,
    onDrop,
    removePk,
    removeSelected,
    updatePane,
    updateMany,
    moveLayer
  };
}
