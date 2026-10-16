import { ElMessageBox } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { approvalApi } from "@/api/approval/approval";
import {
  handleOperation,
  type OperationButtonsRow
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { canActRow } from "./approvalRowRules";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import RefreshLeft from "~icons/ep/refresh-left";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行内按钮装配依赖（弹窗与刷新由调用方提供，两个页签共用） */
export type ApprovalRowButtonDeps = {
  t: TFunction;
  auth: Record<string, boolean | undefined>;
  refresh: () => void;
  openReject: (row: RecordType) => void;
  /** 互跳操作日志按钮（两个页签共用，无读权限时按钮不展示） */
  relatedLogsButton: OperationButtonsRow;
};

/** 待我审批页签：通过（意见选填）/ 驳回 / 操作日志 */
export function pendingRowButtons(
  deps: ApprovalRowButtonDeps
): OperationButtonsRow[] {
  const { t, auth, refresh } = deps;
  return [
    {
      text: t("approval.approve"),
      code: "approve",
      props: {
        type: "primary",
        icon: useRenderIcon(Check),
        link: true
      },
      onClick: async ({ row, loading }) => {
        // 通过意见选填（多级链逐级留痕；后端 comment 字段自始支持，此前前端
        // 不采集导致审批意见恒为空）：输入弹窗承载确认语义，取消输入即中止
        const { value } = await ElMessageBox.prompt(
          t("approval.approveConfirm", {
            no: String(row.pk).slice(0, 8).toUpperCase()
          }),
          t("approval.approve"),
          {
            confirmButtonText: t("buttons.confirm"),
            cancelButtonText: t("buttons.cancel"),
            inputPlaceholder: t("approval.commentPlaceholder")
          }
        ).catch(() => ({ value: null as string | null }));
        if (value === null) return;
        loading.value = true;
        handleOperation({
          t,
          apiReq: approvalApi.approve(row.pk, value || ""),
          success: () => refresh(),
          requestEnd: () => (loading.value = false)
        });
      },
      // 多级链：只有当前级候选人可见（服务端 can_act），避免点了才报「不是当前级审批人」
      index: 4,
      show: row => Boolean(auth.approve && canActRow(row))
    },
    {
      text: t("approval.reject"),
      code: "reject",
      props: {
        type: "danger",
        icon: useRenderIcon(Close),
        link: true
      },
      onClick: ({ row }) => deps.openReject(row),
      index: 5,
      show: row => Boolean(auth.reject && canActRow(row))
    },
    deps.relatedLogsButton
  ];
}

/** 我发起的页签：撤回（仅 PENDING）/ 操作日志 */
export function mineRowButtons(
  deps: ApprovalRowButtonDeps
): OperationButtonsRow[] {
  const { t, auth, refresh } = deps;
  return [
    {
      text: t("approval.cancel"),
      code: "cancel",
      props: {
        type: "info",
        icon: useRenderIcon(RefreshLeft),
        link: true
      },
      confirm: {
        title: row =>
          t("approval.cancelConfirm", {
            no: String(row.pk).slice(0, 8).toUpperCase()
          })
      },
      onClick: ({ row, loading }) => {
        loading.value = true;
        handleOperation({
          t,
          apiReq: approvalApi.cancel(row.pk),
          success: () => refresh(),
          requestEnd: () => (loading.value = false)
        });
      },
      show: row =>
        Boolean(auth.cancel && (row.status?.value ?? row.status) === "PENDING")
    },
    deps.relatedLogsButton
  ];
}

/** 行内按钮组：按页签选择（待我审批 = 通过/驳回；我发起的 = 撤回） */
export function approvalRowButtons(
  scope: "pending" | "mine",
  deps: ApprovalRowButtonDeps
): OperationButtonsRow[] {
  return scope === "pending" ? pendingRowButtons(deps) : mineRowButtons(deps);
}
