import { modelLabelFieldApi } from "@/api/system/field";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { reactive, type Ref, shallowRef } from "vue";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

export function useModelField(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(modelLabelFieldApi);

  const auth = reactive({
    list: hasAuth("list:systemModelField"),
    sync: hasAuth("sync:systemModelField"),
    delete: hasAuth("delete:systemModelField"),
    export: hasAuth("export:systemModelField"),
    import: hasAuth("import:systemModelField"),
    batchDelete: hasAuth("batchDelete:systemModelField")
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("modelFieldManagement.makeData"),
        code: "sync",
        props: {
          type: "primary",
          plain: true,
          icon: useRenderIcon("ep:money")
        },
        onClick: ({ loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.sync(),
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
