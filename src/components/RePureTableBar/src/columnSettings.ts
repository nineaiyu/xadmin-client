import type { CheckboxValueType } from "element-plus";
import type { Ref } from "vue";

import { transformI18n } from "@/plugins/i18n";
import { resolveFixedState, type TableColumnLike } from "./utils";

/**
 * 列设置面板的勾选/固定逻辑（自 bar.tsx 抽出，避免工具栏组件超行数红线）：
 * 全选、勾选同步、单项显隐与左右钉列。状态由调用方以 Ref 注入。
 */
export function createColumnSettings({
  dynamicColumns,
  checkedColumns,
  checkAll,
  isIndeterminate,
  checkColumnList,
  persistPrefs
}: {
  dynamicColumns: Ref<TableColumnLike[]>;
  checkedColumns: Ref<CheckboxValueType[]>;
  checkAll: Ref<boolean>;
  isIndeterminate: Ref<boolean>;
  checkColumnList: Ref<string[]>;
  persistPrefs: () => void;
}) {
  function handleCheckAllChange(val: CheckboxValueType) {
    checkedColumns.value = val ? checkColumnList.value : [];
    isIndeterminate.value = false;
    dynamicColumns.value.map((column: TableColumnLike) =>
      val ? (column.hide = false) : (column.hide = true)
    );
    persistPrefs();
  }

  function handleCheckedColumnsChange(value: CheckboxValueType[]) {
    checkedColumns.value = value;
    const checkedCount = value.length;
    checkAll.value = checkedCount === checkColumnList.value.length;
    isIndeterminate.value =
      checkedCount > 0 && checkedCount < checkColumnList.value.length;
  }

  function handleCheckColumnListChange(val: CheckboxValueType, label: string) {
    dynamicColumns.value.filter(
      (item: TableColumnLike) =>
        transformI18n(item.label) === transformI18n(label)
    )[0].hide = !val;
    persistPrefs();
  }

  function handleToggleColumnFixed(
    fixed: boolean | "left" | "right",
    label: string
  ) {
    const column = dynamicColumns.value.find(
      (item: TableColumnLike) =>
        transformI18n(item.label) === transformI18n(label)
    );
    if (column) {
      column.fixed = fixed as TableColumnLike["fixed"];
    }
  }

  const isFixedColumn = (label: string) => {
    const column = dynamicColumns.value.find(
      (item: TableColumnLike) =>
        transformI18n(item.label) === transformI18n(label)
    );
    return resolveFixedState(column);
  };

  return {
    handleCheckAllChange,
    handleCheckedColumnsChange,
    handleCheckColumnListChange,
    handleToggleColumnFixed,
    isFixedColumn
  };
}
