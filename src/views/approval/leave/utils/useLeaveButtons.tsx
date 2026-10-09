import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { openInstanceDetail } from "@/views/approval/instance/utils/instanceDialogs";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { RESUBMITTABLE, statusOf } from "./leaveRules";
import Check from "~icons/ep/check";
import RefreshLeft from "~icons/ep/refresh-left";
import View from "~icons/ep/view";

type TFunction = ReturnType<typeof useI18n>["t"];

type LeaveRow = Record<string, unknown>;

/**
 * 请假页行内操作按钮（自 hook.tsx 抽出，行数门禁）：提交审批 / 撤回 / 查看审批轨迹。
 *
 * 排序索引避开内置按钮（编辑 -30 / 删除 -20 / 详情 -10 / 变更历史 -5）：
 * 同索引时先后不确定。审批动作不在本页（审批人统一在「流程审批」中心处理）。
 */
export function useLeaveButtons(deps: {
  t: TFunction;
  auth: { submit: boolean; cancel: boolean };
  api: {
    submit: (pk: string | number) => Promise<{ code: number; detail?: string }>;
    cancel: (pk: string | number) => Promise<{ code: number; detail?: string }>;
  };
  confirmAndRun: (
    row: LeaveRow,
    titleKey: string,
    run: (pk: string | number) => Promise<{ code: number; detail?: string }>,
    successKey: string
  ) => void;
}) {
  const { t, auth, api, confirmAndRun } = deps;

  const operationButtonsProps = shallowRef<OperationProps>({
    // showNumber 6：内置 编辑/删除/查看 + 本页 提交审批/撤回 同排展示，
    // 否则超出默认 3 个会被折叠进「更多」下拉（用例与用户都要多点一次）
    width: 300,
    showNumber: 6,
    buttons: [
      {
        code: "submit",
        text: t("leaveApply.submit"),
        props: { type: "primary", link: true, icon: useRenderIcon(Check) },
        index: -25,
        show: (row: LeaveRow) =>
          auth.submit && RESUBMITTABLE.includes(statusOf(row)),
        onClick: ({ row }) =>
          confirmAndRun(
            row as LeaveRow,
            "submitConfirm",
            pk => api.submit(pk),
            "submitSuccess"
          )
      },
      {
        code: "cancel",
        text: t("leaveApply.cancel"),
        props: {
          type: "warning",
          link: true,
          icon: useRenderIcon(RefreshLeft)
        },
        index: -15,
        show: (row: LeaveRow) => auth.cancel && statusOf(row) === "PENDING",
        onClick: ({ row }) =>
          confirmAndRun(
            row as LeaveRow,
            "cancelConfirm",
            pk => api.cancel(pk),
            "cancelSuccess"
          )
      },
      {
        code: "instance",
        text: t("leaveApply.viewInstance"),
        props: { type: "info", link: true, icon: useRenderIcon(View) },
        index: -28,
        // 流程轨迹钻取：后端已随行下发 instance_pk（未提交/草稿为空）；需实例查看权限
        show: (row: LeaveRow) =>
          Boolean((row as { instance_pk?: string }).instance_pk) &&
          hasAuth("retrieve:SystemApprovalInstance"),
        onClick: ({ row }) =>
          openInstanceDetail({
            pk: (row as { instance_pk?: string }).instance_pk,
            title: t("leaveApply.viewInstance")
          })
      }
    ]
  });

  return { operationButtonsProps };
}
