import { shallowRef, type Ref } from "vue";
import type { RecordType } from "plus-pro-components";
import type { RePlusPageProps } from "@/components/RePlusPage";
import { applyDeptParentColumn, deptParentFormValue } from "./deptParentColumn";

/**
 * 部门新增/编辑表单选项（父级列裁剪 + 保存后刷新树）；自 utils/hook 拆出，行为不变。
 */
export function useDeptFormOptions(tableRef: Ref) {
  return shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        parent: ({ rawRow }: { rawRow?: RecordType }) =>
          deptParentFormValue(rawRow)
      },
      columns: {
        parent: ({ column }) => applyDeptParentColumn(column)
      },
      dialogDrawerOptions: {
        closeCallBack: ({ options, args }) => {
          const formInline = options?.props?.formInline as
            { pk?: number | string } | undefined;
          if (!formInline?.pk && args?.command === "sure") {
            tableRef.value?.getPageColumn(false);
          }
        }
      }
    }
  });
}
