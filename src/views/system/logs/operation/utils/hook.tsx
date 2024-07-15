import { operationLogApi } from "@/api/system/logs/operation";
import { useRouter } from "vue-router";
import { reactive, shallowRef } from "vue";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import type { CRUDColumn, OperationProps } from "@/components/RePlusCRUD";

export function useOperationLog() {
  const api = reactive(operationLogApi);

  const auth = reactive({
    list: hasAuth("list:systemOperationLog"),
    delete: hasAuth("delete:systemOperationLog"),
    export: hasAuth("export:systemOperationLog"),
    batchDelete: hasAuth("batchDelete:systemOperationLog")
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140
  });
  const listColumnsFormat = (columns: CRUDColumn[]) => {
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
      }
    });
    return columns;
  };

  const router = useRouter();

  function onGoDetail(row: any) {
    if (hasGlobalAuth("list:systemUser") && row?.creator && row?.creator?.pk) {
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
