import { modelLabelFieldApi } from "@/api/system/field";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { reactive, type Ref, shallowRef } from "vue";
import { handleOperation, type OperationProps } from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

export function useModelField(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(modelLabelFieldApi);

  const auth = reactive({
    list: hasAuth("list:systemModelField"),
    sync: hasAuth("sync:systemModelField"),
    detail: hasAuth("detail:systemModelField"),
    lookups: hasAuth("lookups:systemModelField")
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("modelFieldManagement.makeData"),
        code: "sync",
        props: {
          type: "primary",
          icon: useRenderIcon("ep:money")
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            row,
            apiUrl: api.sync,
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.sync
      }
    ]
  });

  return {
    t,
    api,
    auth,
    tableBarButtonsProps
  };
}
