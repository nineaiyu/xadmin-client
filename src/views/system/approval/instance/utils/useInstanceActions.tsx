import { h, ref, type Ref } from "vue";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import type { NodeProgress } from "@/api/system/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";

import ApproveForm from "../components/ApproveForm.vue";
import RejectForm from "../components/RejectForm.vue";
import UrgeForm from "../components/UrgeForm.vue";
import AddSignForm from "../components/AddSignForm.vue";
import TransferForm from "../components/TransferForm.vue";
import { rowTitle, type TFunction } from "./instanceFormShared";
import {
  openActionDialog,
  type ActionFormInstance
} from "./instanceFormDialog";
import { useInstanceBatchActions } from "./useInstanceBatchActions";

type ActionRow = { pk?: string | number; title?: string };

/** 审批动作弹窗：通过（意见选填）/ 驳回（原因必填）/ 加签 / 转交 / 催办 / 重新提交（批量见 useInstanceBatchActions） */
export function useInstanceActions({
  t,
  refresh,
  tableRef
}: {
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
}) {
  /** 通过：审批意见选填（会签/多级场景下意见随任务留痕，进审批轨迹） */
  const approveFormRef = ref<ActionFormInstance<{ comment: string }>>();
  const openApprove = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.approveTitle", {
        title: rowTitle(row)
      }),
      formRef: approveFormRef,
      render: () => h(ApproveForm, { ref: approveFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.approve(
            row.pk ?? "",
            undefined,
            payload.comment
          ),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 催办：留言选填（通知当前节点审批人；服务端 10 分钟节流） */
  const urgeFormRef = ref<ActionFormInstance<{ message: string }>>();
  const openUrge = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.urgeTitle", { title: rowTitle(row) }),
      formRef: urgeFormRef,
      render: () => h(UrgeForm, { ref: urgeFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.urge(row.pk ?? "", payload.message),
          success: () => {
            message(t("systemApprovalInstance.urgeOk"), { type: "success" });
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 驳回：原因必填（驳回即终止申请） */
  const rejectFormRef = ref<ActionFormInstance<{ reason: string }>>();
  const openReject = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.rejectTitle", {
        title: rowTitle(row)
      }),
      formRef: rejectFormRef,
      render: () => h(RejectForm, { ref: rejectFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.reject(row.pk ?? "", payload.reason),
          success: () => {
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 加签：多选选人（无选人权限时表单内部回退用户名输入） */
  const addSignFormRef =
    ref<ActionFormInstance<{ usernames: string; comment: string }>>();
  const openAddSign = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.addSignTitle", {
        title: rowTitle(row)
      }),
      formRef: addSignFormRef,
      render: () => h(AddSignForm, { ref: addSignFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.addSign(
            row.pk ?? "",
            payload.usernames,
            payload.comment
          ),
          success: res => {
            done();
            refresh();
            // 加签抬高节点任务总数：用服务端回带的新达标线提示（比例会签透明可预期）
            const progress = (
              res?.data as { node_progress?: NodeProgress } | undefined
            )?.node_progress;
            if (progress && progress.required > 1) {
              message(
                t("systemApprovalInstance.addSignThreshold", {
                  approved: progress.approved,
                  required: progress.required,
                  total: progress.total
                }),
                { type: "info" }
              );
            }
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 转交：把我的当前待办交给他人处理（一次性，区别于「委托」的长期代理） */
  const transferFormRef =
    ref<ActionFormInstance<{ username: string; comment: string }>>();
  const openTransfer = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.transferTitle", {
        title: rowTitle(row)
      }),
      formRef: transferFormRef,
      render: () => h(TransferForm, { ref: transferFormRef }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.transfer(
            row.pk ?? "",
            payload.username,
            payload.comment
          ),
          success: () => {
            message(t("systemApprovalInstance.transferOk"), {
              type: "success"
            });
            done();
            refresh();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  // 批量动作（通过/驳回/转交）拆在 useInstanceBatchActions，这里转发保持调用面不变
  const batchActions = useInstanceBatchActions({ t, refresh, tableRef });

  return {
    openApprove,
    openUrge,
    openReject,
    openAddSign,
    openTransfer,
    ...batchActions
  };
}
