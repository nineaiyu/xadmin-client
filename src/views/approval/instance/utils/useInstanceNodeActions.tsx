import { h, ref } from "vue";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";

import AddSignForm from "../components/AddSignForm.vue";
import RemoveSignForm from "../components/RemoveSignForm.vue";
import ReturnForm from "../components/ReturnForm.vue";
import TransferForm from "../components/TransferForm.vue";
import {
  rowTitle,
  notifyNodeProgress,
  type TFunction
} from "./instanceFormShared";
import {
  openActionDialog,
  type ActionFormInstance
} from "./instanceFormDialog";

type ActionRow = { pk?: string | number; title?: string };

/**
 * 审批实例节点动作弹窗：加签 / 减签 / 退回 / 转交。
 * 自 useInstanceActions 拆出（行为不变）：四者均为「弹窗选人/选节点 → 标准请求 →
 * 刷新」，会签类动作成功后按服务端 node_progress 提示新达标线（共用 notifyNodeProgress）。
 */
export function useInstanceNodeActions({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
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
            notifyNodeProgress(res, t);
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

  /** 减签：移除加签追加的候选（弹窗内列出当前节点的加签待办；返回新达标线提示） */
  const removeSignFormRef =
    ref<ActionFormInstance<{ task: string; comment: string }>>();
  const openRemoveSign = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.removeSignTitle", {
        title: rowTitle(row)
      }),
      formRef: removeSignFormRef,
      render: () =>
        h(RemoveSignForm, { ref: removeSignFormRef, pk: row.pk ?? "" }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.removeSign(
            row.pk ?? "",
            payload.task,
            payload.comment
          ),
          success: res => {
            done();
            refresh();
            notifyNodeProgress(res, t);
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 退回：实例回退到已途经节点重开重审（目标节点与原因在弹窗内选择） */
  const returnFormRef =
    ref<ActionFormInstance<{ reason: string; target_order?: number }>>();
  const openReturn = (row: ActionRow) => {
    openActionDialog({
      title: t("systemApprovalInstance.returnTitle", {
        title: rowTitle(row)
      }),
      formRef: returnFormRef,
      render: () => h(ReturnForm, { ref: returnFormRef, pk: row.pk ?? "" }),
      submit: (payload, done, closeLoading) => {
        handleOperation({
          t,
          apiReq: approvalInstanceApi.returnTo(
            row.pk ?? "",
            payload.reason,
            payload.target_order
          ),
          success: () => {
            message(t("systemApprovalInstance.returnOk"), {
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

  return {
    openAddSign,
    openTransfer,
    openRemoveSign,
    openReturn
  };
}
