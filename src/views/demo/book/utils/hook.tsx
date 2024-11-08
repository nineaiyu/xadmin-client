import { bookApi } from "./api";
import { getCurrentInstance, reactive, type Ref, shallowRef } from "vue";
import { getDefaultAuths } from "@/router/utils";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";
import { handleOperation } from "@/components/RePlusPage";
import { useI18n } from "vue-i18n";

export function useDemoBook(tableRef: Ref) {
  // 权限判断，用于判断是否有该权限
  const api = reactive(bookApi);
  const auth = reactive({
    push: false,
    ...getDefaultAuths(getCurrentInstance(), ["push"])
  });
  const { t } = useI18n();

  /**
   * 添加一个推送书籍的自定义操作按钮，用于控制书籍推送
   */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 300,
    showNumber: 4,
    buttons: [
      {
        text: t("demoBook.pushBook"),
        code: "push",
        confirm: {
          title: row => {
            return t("demoBook.confirmPushBook", { name: row.name });
          }
        },
        props: {
          type: "success",
          icon: useRenderIcon(CircleClose),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.push(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.push && 6
      }
    ]
  });
  return {
    api,
    auth,
    operationButtonsProps
  };
}
