import { shallowRef } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation } from "@/components/RePlusPage";
import CircleClose from "~icons/ep/circle-close";
import Upload from "~icons/ep/upload";
import type { bookApi } from "./api";
import type { OperationProps } from "@/components/RePlusPage";
import type { Ref, UnwrapNestedRefs } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 书籍列表按钮（自 hook.tsx 抽出）：行内「提交审批 / 推送」。
 *
 * 原「批量推送」按钮已移除：确认后仅弹成功提示、不调用任何接口（后端也无对应
 * 批量端点），属于假成功交互；批量能力需要时先补齐端点再恢复。
 */
export function useBookButtons({
  t,
  api,
  auth,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof bookApi>;
  auth: { submit?: boolean; push?: boolean };
  tableRef: Ref;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 300,
    showNumber: 4,
    buttons: [
      {
        text: t("demoBook.submitBook"),
        code: "submit",
        confirm: {
          title: row => {
            return t("demoBook.confirmSubmitBook", { name: row.name });
          }
        },
        props: {
          type: "primary",
          icon: useRenderIcon(Upload),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.submit(row?.pk),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        index: 5,
        show: auth.submit
      },
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
            apiReq: api.push(row?.pk),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        index: 6,
        show: auth.push
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: []
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
