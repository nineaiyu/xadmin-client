import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { approvalApi } from "@/api/approval/approval";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { openRejectReasonDialog } from "./dialogs";
import { batchRejectFailedDetail } from "./approvalTexts";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import type { Ref } from "vue";

/**
 * 审批面板工具栏：批量通过（仅待我审批页签，作用于勾选行）与批量驳回。
 * 自 useApprovalPanel 拆出（行为不变）：驳回原因必填，逐单校验由服务端收口
 * （部分失败明细逐条提示）。
 */
export function useApprovalToolbar({
  auth,
  tableRef,
  refresh
}: {
  auth: Record<string, boolean | undefined>;
  tableRef: Ref;
  refresh: () => void;
}) {
  const { t } = useI18n();

  /** 批量驳回弹窗：原因必填，逐单校验由服务端收口（部分失败明细逐条提示） */
  const openBatchReject = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    openRejectReasonDialog({
      t,
      title: t("approval.batchRejectTitle", { n: pks.length }),
      submit: reason => approvalApi.batchReject(pks, reason),
      onSuccess: res => {
        const failed =
          (res?.data as { failed?: Array<{ no: string; reason: string }> })
            ?.failed ?? [];
        if (failed.length) {
          message(
            t("approval.batchRejectPartial", {
              n: failed.length,
              detail: batchRejectFailedDetail(failed)
            }),
            { type: "warning" }
          );
        }
        refresh();
      }
    });
  };

  /** 工具栏批量通过（仅待我审批页签，作用于勾选行） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("approval.batchApprove"),
        code: "batchApprove",
        confirm: {
          title: t("approval.batchApproveConfirm")
        },
        props: {
          type: "primary",
          icon: useRenderIcon(Check),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: approvalApi.batchApprove(pks),
            success: () => refresh(),
            requestEnd: () => (loading.value = false)
          });
        },
        show: auth.batchApprove
      },
      {
        text: t("approval.batchReject"),
        code: "batchReject",
        props: {
          type: "danger",
          icon: useRenderIcon(Close),
          plain: true
        },
        tooltip: { content: t("approval.batchReject") },
        onClick: () => openBatchReject(),
        show: auth.batchReject
      }
    ]
  });

  return {
    tableBarButtonsProps
  };
}
