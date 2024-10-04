import { operationLogApi } from "@/api/system/logs/operation";
import { useRouter } from "vue-router";
import { reactive, shallowRef } from "vue";
import { hasAuth } from "@/router/utils";
import type {
  PageColumn,
  OperationProps,
  PageColumnList
} from "@/components/RePlusPage";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";

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
  const listColumnsFormat = (columns: PageColumnList[]) => {
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
  const detailColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "response_result":
        case "body":
          column["descriptionsItemProps"] = {
            span: 2
          };
          // column["valueType"] = "copy";
          column["renderDescriptionsItem"] = ({ row }) => {
            let data = row[column._column?.key];
            try {
              data = JSON.parse(data);
            } catch {}
            return (
              <el-scrollbar max-height="calc(100vh - 240px)">
                <VueJsonPretty data={data} v-copy={row[column._column?.key]} />
              </el-scrollbar>
            );
          };
          break;
      }
    });
    return columns;
  };

  const router = useRouter();

  function onGoDetail(row: any) {
    if (hasAuth("list:systemUser") && row?.creator && row?.creator?.pk) {
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
    detailColumnsFormat,
    operationButtonsProps
  };
}
