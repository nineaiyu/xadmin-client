import { useI18n } from "vue-i18n";
import { systemConfigApi } from "@/api/system/config/system";
import { hasAuth } from "@/router/utils";
import { reactive, type Ref, shallowRef } from "vue";
import { handleOperation, type OperationProps } from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";

export function useSystemConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemConfigApi);

  const auth = reactive({
    list: hasAuth("list:systemSystemConfig"),
    create: hasAuth("create:systemSystemConfig"),
    delete: hasAuth("delete:systemSystemConfig"),
    update: hasAuth("update:systemSystemConfig"),
    invalid: hasAuth("invalid:systemSystemConfig"),
    export: hasAuth("export:systemSystemConfig"),
    import: hasAuth("import:systemSystemConfig"),
    batchDelete: hasAuth("batchDelete:systemSystemConfig")
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 260,
    buttons: [
      {
        text: t("configSystem.invalidCache"),
        code: "invalid",
        confirm: { title: t("configSystem.confirmInvalid") },
        props: {
          type: "danger",
          icon: useRenderIcon(CircleClose),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            row,
            apiUrl: api.invalid,
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.invalid
      },
      {
        code: "detail",
        show: false
      }
    ]
  });

  return {
    api,
    auth,
    operationButtonsProps
  };
}
