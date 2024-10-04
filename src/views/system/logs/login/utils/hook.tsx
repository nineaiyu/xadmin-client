import { useI18n } from "vue-i18n";
import { loginLogApi } from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { reactive, shallowRef } from "vue";
import { usePublicHooks } from "@/views/system/hooks";
import {
  type PageColumnList,
  type OperationProps,
  renderBooleanTag
} from "@/components/RePlusPage";

export function useLoginLog() {
  const { t } = useI18n();
  const api = reactive(loginLogApi);

  const auth = reactive({
    list: hasAuth("list:systemLoginLog"),
    delete: hasAuth("delete:systemLoginLog"),
    export: hasAuth("export:systemLoginLog"),
    batchDelete: hasAuth("batchDelete:systemLoginLog")
  });

  const router = useRouter();
  const { tagStyle } = usePublicHooks();

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
        case "status":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop,
            actionMap: { true: t("labels.success"), false: t("labels.failed") }
          });
          break;
      }
    });
    return columns;
  };

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
    operationButtonsProps
  };
}
