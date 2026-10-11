import { computed, ref, type Ref } from "vue";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import { canPlace, clampBox, gridMetrics, type PaneBox } from "./layout";
import { createPaneOps } from "./paneOps";
import { useCanvasDrag } from "./canvasDrag";
import { nudgeCoalesceKey } from "./history";
import type { TranslateFn } from "./types";

/** 栅格画布板的暴露面（只用画布元素做「像素 → 格数」换算） */
export type GridBoardHandle = { canvasEl?: HTMLElement } | null;

/**
 * 栅格画布编辑域（设计器组装层与画布板之间的唯一接口，与 `createFreeEditor` 对称）。
 *
 * 覆盖：载荷装载、窗格增删改（`paneOps`：新增找空位、重叠驳回）、拖拽 / 缩放步进
 * （`canvasDrag`，像素增量换算成格数）、组件库点击与拖放、方向键微调（Shift = 缩放）。
 * 栅格模式保持**单选**语义（多选是自由画布的能力，不引入到栅格以免语义复杂化）。
 */
export function createGridEditor(deps: {
  t: TranslateFn;
  markDirty: () => void;
  pushHistory: (key?: string) => void;
  /** 画布板句柄（画布元素挂载后可用） */
  board: Ref<GridBoardHandle>;
}) {
  const panes = ref<ScreenLayoutPane[]>([]);
  const selectedPk = ref("");

  const selected = computed(() =>
    panes.value.find(pane => pane.pk === selectedPk.value)
  );
  const metrics = () =>
    gridMetrics(deps.board.value?.canvasEl?.clientWidth ?? 0);

  const ops = createPaneOps({
    panes,
    selectedPk,
    pushHistory: deps.pushHistory,
    t: deps.t
  });

  const { startTracking } = useCanvasDrag({
    panes,
    selectedPk,
    markDirty: deps.markDirty,
    metrics,
    pushHistory: deps.pushHistory
  });

  /** 装载详情接口的栅格载荷（服务端已归一化，前端只读） */
  function load(layout?: ScreenLayoutPane[]) {
    panes.value = [...(layout ?? [])];
    selectedPk.value = "";
  }

  const addPane = (type: ScreenPaneType, dashboard?: string) =>
    ops.addPane(type, dashboard);

  /** 组件库拖放：落点已换算为格下标（越界 / 重叠由 paneOps 兜底找空位） */
  const onDrop = (payload: {
    type: ScreenPaneType;
    dashboard?: string;
    at: PaneBox;
  }) => ops.addPane(payload.type, payload.dashboard, payload.at);

  /** 方向键移动 / 缩放：与拖拽同口径（夹回栅格 + 重叠驳回） */
  function nudge(
    pane: ScreenLayoutPane,
    dx: number,
    dy: number,
    shift: boolean
  ) {
    const index = panes.value.findIndex(item => item.pk === pane.pk);
    if (index < 0) return false;
    const next = shift
      ? clampBox({ ...pane, w: pane.w + dx, h: pane.h + dy })
      : clampBox({ ...pane, x: pane.x + dx, y: pane.y + dy });
    if (!canPlace(panes.value, next, index)) return false;
    deps.pushHistory(nudgeCoalesceKey(pane.pk, shift));
    panes.value[index] = { ...pane, ...next };
    return true;
  }

  const selectPk = (pk: string) => {
    selectedPk.value = pk;
  };
  const clearSelection = () => {
    selectedPk.value = "";
  };
  /** 删除选区（栅格单选）：删除后清空选中 */
  function removeSelected() {
    if (selectedPk.value) ops.removePane(selectedPk.value);
    selectedPk.value = "";
  }

  return {
    panes,
    selectedPk,
    selected,
    addPane,
    removePane: ops.removePane,
    updatePane: ops.updatePane,
    duplicateSelected: ops.duplicateSelected,
    startTracking,
    onDrop,
    nudge,
    load,
    selectPk,
    clearSelection,
    removeSelected
  };
}

export type GridEditorApi = ReturnType<typeof createGridEditor>;
