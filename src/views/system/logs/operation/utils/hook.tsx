import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { operationLogApi } from "@/api/system/logs/operation";
import { getCurrentInstance, reactive, shallowRef } from "vue";

export function useOperationLog() {
  const api = reactive(operationLogApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140
  });
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "creator":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row as any)}>
              {row.creator?.username ? row.creator?.username : "/"}
            </el-link>
          );
          break;
        case "path":
          column["cellRenderer"] = ({ row }) => (
            <span>
              {row.method}: {row.path}
            </span>
          );
          break;
        case "method":
          column.hide = true;
          break;
        case "status_code":
          column["minWidth"] = 100;
          break;
        case "module":
          column["minWidth"] = 200;
          break;
      }
    });
    return columns;
  };

  const router = useRouter();

  function onGoDetail(row: any) {
    if (hasAuth("list:SystemUser") && row?.creator && row?.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
