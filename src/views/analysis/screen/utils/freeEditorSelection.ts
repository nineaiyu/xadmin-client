import { computed, type Ref } from "vue";
import { mergeUnique } from "@/utils/unique";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

/** 自由画布的选择模型（单选目标派生 / 加选 / 全选；写入归组合层） */
export type FreeSelectionApi = ReturnType<typeof createFreeSelection>;

export function createFreeSelection(
  panes: Ref<ScreenLayoutPane[]>,
  selection: Ref<string[]>
) {
  const selectedPk = computed(
    () => selection.value[selection.value.length - 1] ?? ""
  );
  /** 主选窗格（快捷键判定用：多选时方向键整组移动，仍以主选为判定目标） */
  const primaryPane = computed(() =>
    panes.value.find(pane => pane.pk === selectedPk.value)
  );
  /** 单选目标（多选时为空：属性面板切换为多选面板） */
  const singleSelected = computed(() =>
    selection.value.length === 1 ? primaryPane.value : undefined
  );
  const selectionCount = computed(() => selection.value.length);

  function selectPk(pk: string, additive = false) {
    if (!pk) {
      selection.value = [];
      return;
    }
    if (!additive) {
      selection.value = [pk];
      return;
    }
    selection.value = selection.value.includes(pk)
      ? selection.value.filter(item => item !== pk)
      : [...selection.value, pk];
  }

  /** 框选结果：追加则并入现有选区，否则整体替换 */
  function selectMany(pks: string[], additive = false) {
    if (!additive) {
      selection.value = [...pks];
      return;
    }
    selection.value = mergeUnique(selection.value, pks);
  }

  const selectAll = () => {
    selection.value = panes.value.map(pane => pane.pk);
  };
  const clearSelection = () => {
    selection.value = [];
  };

  return {
    selectedPk,
    primaryPane,
    singleSelected,
    selectionCount,
    selectPk,
    selectMany,
    selectAll,
    clearSelection
  };
}
