import { h, ref, type Ref } from "vue";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";

import ApproveForm from "../components/ApproveForm.vue";
import RejectForm from "../components/RejectForm.vue";
import TransferForm from "../components/TransferForm.vue";
import {
  openActionDialog,
  type ActionFormInstance
} from "./instanceFormDialog";
import type { TFunction } from "./instanceFormShared";

/**
 * 实例**批量**动作弹窗（自 useInstanceActions 拆出，仅因文件行数门禁）：
 * 批量通过 / 批量驳回 / 批量转交——都以「勾选的行（getSelectPks）」为作用域，
 * 服务端逐条独立校验（部分失败给明细，不整体拒绝）。
 *
 * 表单复用单行动作的同名组件（载荷结构一致，只有弹窗标题与成功文案不同）。
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
    openActionDialog({
      title: t("systemApprovalInstance.batchApproveTitle", { n: pks.length }),
      formRef: batchApproveFormRef,
      render: () => h(ApproveForm, { ref: batchApproveFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchApprove(pks, payload.comment),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 批量驳回：原因必填，部分失败明细逐条提示（服务端逐单校验） */
  const batchRejectFormRef = ref<ActionFormInstance<{ reason: string }>>();
  const openBatchReject = () => {
    const pks = selectedPks();
    if (!pks) return;
    openActionDialog({
      title: t("systemApprovalInstance.batchRejectTitle", { n: pks.length }),
      formRef: batchRejectFormRef,
      render: () => h(RejectForm, { ref: batchRejectFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchReject(pks, payload.reason),
          success: res => {
            done();
            const failed =
              (res?.data as { failed?: Array<{ no: string; reason: string }> })
                ?.failed ?? [];
            if (failed.length) {
              message(
                t("systemApprovalInstance.batchRejectPartial", {
                  n: failed.length,
                  detail: failed
                    .map(item => `${item.no}: ${item.reason}`)
                    .join("；")
                }),
                { type: "warning" }
              );
            }
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 批量转交：把勾选的多条待办一次性交给同一人（逐条独立，部分失败给明细） */
  const batchTransferFormRef =
    ref<ActionFormInstance<{ username: string; comment: string }>>();
  const openBatchTransfer = () => {
    const pks = selectedPks();
    if (!pks) return;
    openActionDialog({
      title: t("systemApprovalInstance.batchTransferTitle", { n: pks.length }),
      formRef: batchTransferFormRef,
      render: () => h(TransferForm, { ref: batchTransferFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.batchTransfer(
            pks,
            payload.username,
            payload.comment
          ),
          // 成功文案由服务端 detail 给出（「X 条已转交，Y 条失败」）；部分失败再补明细
          success: res => {
            done();
            const failures =
              (
                res?.data as {
                  failures?: Array<{ pk: string; detail: string }>;
                }
              )?.failures ?? [];
            if (failures.length) {
              message(
                t("systemApprovalInstance.batchTransferPartial", {
                  n: failures.length,
                  detail: failures
                    .slice(0, 3)
                    .map(item => item.detail)
                    .join("；")
                }),
                { type: "warning" }
              );
            }
            refresh();
          },
          failed: res => {
            // 全失败：服务端带首个失败原因，弹窗保持打开便于改人重试
            const failures =
              (
                res?.data as {
                  failures?: Array<{ pk: string; detail: string }>;
                }
              )?.failures ?? [];
            if (failures.length) {
              message(failures[0].detail, { type: "error" });
            }
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  return { openBatchApprove, openBatchTransfer, openBatchReject };
}
