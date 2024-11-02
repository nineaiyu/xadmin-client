import { useI18n } from "vue-i18n";
import { systemConfigApi } from "@/api/system/config/system";
import { getDefaultAuths } from "@/router/utils";
import { getCurrentInstance, reactive, type Ref, shallowRef } from "vue";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";

export function useSystemConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(systemConfigApi);

  const auth = reactive({
    invalid: false,
    ...getDefaultAuths(getCurrentInstance(), ["invalid"])
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 250,
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
            apiReq: api.invalid(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.invalid && 3
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
