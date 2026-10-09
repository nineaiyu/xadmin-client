import { h, ref, type Ref } from "vue";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { message } from "@/utils/message";

import ApproveForm from "../components/ApproveForm.vue";
import RejectForm from "../components/RejectForm.vue";
import TransferForm from "../components/TransferForm.vue";
import type { ActionFormInstance } from "./instanceFormDialog";
import { openBatchAction } from "./instanceBatchOutcome";
import type { TFunction } from "./instanceFormShared";

/**
 * 实例**批量**动作弹窗：批量通过 / 批量驳回 / 批量转交——都以「勾选的行
 * （getSelectPks）」为作用域，服务端逐条独立校验（部分失败给明细，不整体拒绝），
 * 弹窗与结果收口见 instanceBatchOutcome.ts；表单复用单行动作的同名组件。
 */
export function useInstanceBatchActions({
  t,
  refresh,
  tableRef
}: {
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
}) {
  /** 勾选行主键：无选中时提示并中止（不弹窗） */
  const selectedPks = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return null;
    }
    return pks as Array<string | number>;
  };

  /** 批量通过：意见选填（逐单落同一意见） */
  const batchApproveFormRef = ref<ActionFormInstance<{ comment: string }>>();
  const openBatchApprove = () => {
    const pks = selectedPks();
    if (!pks) return;
    openBatchAction({
      t,
      pks,
      refresh,
      titleKey: "systemApprovalInstance.batchApproveTitle",
      partialKey: "systemApprovalInstance.batchApprovePartial",
      formRef: batchApproveFormRef,
      render: () => h(ApproveForm, { ref: batchApproveFormRef }),
      apiReq: payload => approvalInstanceApi.batchApprove(pks, payload.comment)
    });
  };

  /** 批量驳回：原因必填（部分失败明细逐条提示） */
  const batchRejectFormRef = ref<ActionFormInstance<{ reason: string }>>();
  const openBatchReject = () => {
    const pks = selectedPks();
    if (!pks) return;
    openBatchAction({
      t,
      pks,
      refresh,
      titleKey: "systemApprovalInstance.batchRejectTitle",
      partialKey: "systemApprovalInstance.batchRejectPartial",
      formRef: batchRejectFormRef,
      render: () => h(RejectForm, { ref: batchRejectFormRef }),
      apiReq: payload => approvalInstanceApi.batchReject(pks, payload.reason)
    });
  };

  /** 批量转交：勾选的多条待办一次交给同一人（部分失败只带 3 条明细，全失败给首条原因） */
  const batchTransferFormRef =
    ref<ActionFormInstance<{ username: string; comment: string }>>();
  const openBatchTransfer = () => {
    const pks = selectedPks();
    if (!pks) return;
    openBatchAction({
      t,
      pks,
      refresh,
      titleKey: "systemApprovalInstance.batchTransferTitle",
      partialKey: "systemApprovalInstance.batchTransferPartial",
      limit: 3,
      handleFailed: true,
      formRef: batchTransferFormRef,
      render: () => h(TransferForm, { ref: batchTransferFormRef }),
      apiReq: payload =>
        approvalInstanceApi.batchTransfer(
          pks,
          payload.username,
          payload.comment
        )
    });
  };

  return { openBatchApprove, openBatchTransfer, openBatchReject };
}
