import { getKeyList } from "@pureadmin/utils";
import type { Ref } from "vue";

/** 表格选择态辅助（自 usePlusPageState.ts 抽出）：勾选计数、清空勾选与取勾选主键 */
export function createSelectionHelpers({
  emit,
  tableRef,
  selectedNum
}: {
  emit: (event: string, ...args: unknown[]) => void;
  tableRef: Ref;
  selectedNum: Ref<number>;
}) {
  const handleSelectionChange = (val: Array<{ pk?: string | number }>) => {
    selectedNum.value = val.length;
    emit("selectionChange", tableRef.value.getTableRef().getSelectionRows());
  };

  const onSelectionCancel = () => {
    selectedNum.value = 0;
    tableRef.value.getTableRef().clearSelection();
  };

  const getSelectPks = (key = "pk") => {
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    return getKeyList(manySelectData, key);
  };

  return { handleSelectionChange, onSelectionCancel, getSelectPks };
}
