/**
 * 多选模式与批量操作：默认收起复选框（保持树的干净），开启后出现批量操作条。
 *
 * 联动口径：默认父子联动（勾选目录 = 整棵子树），可在工具栏「更多」切为独立勾选；
 * 批量启停会自动带上被勾选目录的后代（半选父级不进入 getCheckedKeys）。
 */

import { computed, ref, type Ref } from "vue";
import type { TreeInstance } from "element-plus";
import type { MenuRow } from "./types";

interface MenuSelectionDeps {
  treeRef: Ref<TreeInstance | undefined>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  /** 批量启停（内部含「连同后代」与确认） */
  setRowsActive: (rows: MenuRow[], isActive: boolean) => Promise<boolean>;
  /** 批量删除（内部含影响面确认） */
  removeRows: (rows: MenuRow[]) => Promise<boolean>;
}

export function useMenuSelection({
  treeRef,
  rowIndex,
  setRowsActive,
  removeRows
}: MenuSelectionDeps) {
  const multiMode = ref(false);
  const checkedPks = ref<Array<number | string>>([]);

  const checkedRows = computed(() =>
    checkedPks.value
      .map(pk => rowIndex.value.byPk.get(String(pk)))
      .filter((row): row is MenuRow => Boolean(row))
  );
  const checkedCount = computed(() => checkedRows.value.length);

  const setChecked = (pks: Array<number | string>) => {
    checkedPks.value = pks;
  };

  const clearSelection = () => {
    checkedPks.value = [];
    treeRef.value?.setCheckedKeys([], false);
  };

  const toggleMultiMode = (enabled: boolean) => {
    multiMode.value = enabled;
    if (!enabled) clearSelection();
  };

  /** 全选可见树（含各层节点；联动模式下等价于勾选全部） */
  const selectAllVisible = (rows: MenuRow[]) => {
    const pks: Array<number | string> = [];
    const walk = (list: MenuRow[]) => {
      list.forEach(row => {
        pks.push(row.pk);
        if (row.children.length) walk(row.children);
      });
    };
    walk(rows);
    treeRef.value?.setCheckedKeys(pks, false);
    checkedPks.value = pks;
  };

  const batchActive = async (isActive: boolean) => {
    const ok = await setRowsActive(checkedRows.value, isActive);
    if (ok) clearSelection();
  };

  const batchRemove = async () => {
    const ok = await removeRows(checkedRows.value);
    if (ok) clearSelection();
  };

  return {
    multiMode,
    checkedPks,
    checkedRows,
    checkedCount,
    setChecked,
    clearSelection,
    toggleMultiMode,
    selectAllVisible,
    batchActive,
    batchRemove
  };
}
