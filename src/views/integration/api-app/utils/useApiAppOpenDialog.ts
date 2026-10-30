import type { Ref } from "vue";
import type { ApiApplicationItem } from "@/api/identity/open";

/** 「管理」抽屉编辑 / 工具栏新增共用框架表单入口 */
export function useApiAppOpenDialog(tableRef: Ref) {
  const openDialog = (row: ApiApplicationItem | null) => {
    if (row) tableRef.value?.handleAddOrEdit?.(false, row);
    else tableRef.value?.handleAddOrEdit?.(true);
  };
  return { openDialog };
}
