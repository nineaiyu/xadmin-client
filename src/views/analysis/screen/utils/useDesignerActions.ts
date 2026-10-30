import type { ComputedRef } from "vue";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { GridEditorApi } from "./createGridEditor";
import type { FreeEditorApi } from "./createFreeEditor";

/**
 * 设计器「模式分派动作」（自 designer.vue 抽出，行数门禁）。
 *
 * 编排层对画布的写操作几乎都是同一形状：按当前模式落到对应编辑域——
 * 栅格走 `grid`（重叠驳回 / 单选），自由走 `free`（夹回画幅 / 多选整组）。
 * 这里集中这些一行分派；「三键 + zoom 键盘档位只在自由模式生效」的口径
 * 也在此收口：按模式判定而非装配期取函数（模式可中途切换）。
 */
export function useDesignerActions(deps: {
  isFree: ComputedRef<boolean>;
  readonly: ComputedRef<boolean>;
  grid: GridEditorApi;
  free: FreeEditorApi;
}) {
  /** 组件库点击：按当前模式落到对应载荷（栅格找空位 / 自由层叠错开） */
  const onPaletteAdd = (type: ScreenPaneType, dashboard?: string) =>
    deps.isFree.value
      ? deps.free.addPane(type, dashboard)
      : deps.grid.addPane(type, dashboard);

  /** 属性面板更新：按当前模式落到对应载荷（栅格重叠驳回 / 自由夹回画幅） */
  const updateSelected = (patch: Partial<ScreenLayoutPane>) =>
    deps.isFree.value
      ? deps.free.updatePane(patch)
      : deps.grid.updatePane(patch);

  const duplicatePane = () =>
    deps.isFree.value ? deps.free.duplicate() : deps.grid.duplicateSelected();
  const removeSelected = () =>
    deps.isFree.value ? deps.free.removeSelected() : deps.grid.removeSelected();
  const clearSelection = () =>
    deps.isFree.value ? deps.free.clearSelection() : deps.grid.clearSelection();

  /** 方向键：栅格 = 移动（Shift 缩放），自由 = 整组移动（Shift 10px 步进） */
  function nudge(
    pane: ScreenLayoutPane,
    dx: number,
    dy: number,
    shift: boolean
  ) {
    if (deps.readonly.value) return false;
    return deps.isFree.value
      ? deps.free.nudge(dx, dy, shift)
      : deps.grid.nudge(pane, dx, dy, shift);
  }

  // 复制粘贴 / 全选三键只在自由模式生效（栅格无剪贴板语义）
  const copy = () => {
    if (deps.isFree.value) deps.free.copy();
  };
  const paste = () => {
    if (deps.isFree.value) deps.free.paste();
  };
  const selectAll = () => {
    if (deps.isFree.value) deps.free.selectAll();
  };
  // zoom 键盘档位同样只在自由模式生效（栅格画布是响应式布局，无固定画幅）
  const zoomIn = () => {
    if (deps.isFree.value) deps.free.zoomIn();
  };
  const zoomOut = () => {
    if (deps.isFree.value) deps.free.zoomOut();
  };
  const zoomFit = () => {
    if (deps.isFree.value) deps.free.fitToView();
  };

  return {
    onPaletteAdd,
    updateSelected,
    duplicatePane,
    removeSelected,
    clearSelection,
    nudge,
    copy,
    paste,
    selectAll,
    zoomIn,
    zoomOut,
    zoomFit
  };
}
