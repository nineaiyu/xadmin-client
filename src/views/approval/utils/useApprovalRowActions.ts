import { h, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/approval/approval";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ApprovalLogsDialog from "../components/ApprovalLogsDialog.vue";
import { openRejectReasonDialog } from "./dialogs";
import { canActRow } from "./approvalRowRules";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Document from "~icons/ep/document";
import RefreshLeft from "~icons/ep/refresh-left";
import type { RecordType } from "plus-pro-components";

/**
 * 审批面板行内操作：通过/驳回（待我审批）与撤回（我发起的），及互跳操作日志。
 * 自 useApprovalPanel 拆出（行为不变）：多级链按服务端 can_act 收口
 * （见 approvalRowRules.ts）。
 */
export function useApprovalRowActions({
  scope,
  auth,
  refresh
}: {
  scope: "pending" | "mine";
  auth: Record<string, boolean | undefined>;
  refresh: () => void;
}) {
  const { t } = useI18n();

  /** 互跳抽屉要读操作日志：无该菜单权限时按钮不展示（否则必然 403） */
  const canReadOperationLog = hasAuth("list:SystemOperationLog");

  /** 驳回弹窗（弹窗工厂见 utils/dialogs.tsx）：原因必填 + 成功后刷新列表/角标/统计 */
  const openReject = (row: RecordType) => {
    openRejectReasonDialog({
      t,
      title: t("approval.rejectTitle", {
        no: String(row.pk).slice(0, 8).toUpperCase()
      }),
      submit: reason => approvalApi.reject(row.pk, reason),
      onSuccess: () => refresh()
    });
  };

  /** 互跳：查看该审批单对应的操作日志（近似口径，弹窗内已标注） */
  const openRelatedLogs = (row: RecordType) => {
    addDialog({
      title: `${t("approval.relatedLogs")} - ${String(row.pk).slice(0, 8).toUpperCase()}`,
      width: "860px",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: {
        path: row.path,
        objectPk: row.object_pk,
        creatorPk: row.creator?.pk
      },
      contentRenderer: () => h(ApprovalLogsDialog)
    });
  };

  /** 互跳按钮：两个页签共用（无操作日志读权限时不展示） */
  const relatedLogsButton: OperationButtonsRow = {
    text: t("approval.relatedLogs"),
    code: "relatedLogs",
    props: {
      type: "info",
      icon: useRenderIcon(Document),
      link: true
    },
    tooltip: { content: t("approval.relatedLogs") },
    onClick: ({ row }) => openRelatedLogs(row),
    show: canReadOperationLog && 6
  };

  /** 行内按钮：待我审批页签 = 通过/驳回；我发起的页签 = 撤回（仅 PENDING） */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 300,
    buttons:
      scope === "pending"
        ? [
            {
              text: t("approval.approve"),
              code: "approve",
              props: {
                type: "primary",
                icon: useRenderIcon(Check),
                link: true
              },
              confirm: {
                // renderString 以 (row, buttonRow) 直传首参，不能写 ({ row }) 解构
                title: row =>
                  t("approval.approveConfirm", {
                    no: String(row.pk).slice(0, 8).toUpperCase()
                  })
              },
              onClick: ({ row, loading }) => {
                loading.value = true;
                handleOperation({
                  t,
                  apiReq: approvalApi.approve(row.pk),
                  success: () => refresh(),
                  requestEnd: () => (loading.value = false)
                });
              },
              // 多级链：只有当前级候选人可见（服务端 can_act），避免点了才报「不是当前级审批人」
              show: row => (auth.approve && canActRow(row) ? 4 : false)
            },
            {
              text: t("approval.reject"),
              code: "reject",
              props: {
                type: "danger",
                icon: useRenderIcon(Close),
                link: true
              },
              onClick: ({ row }) => openReject(row),
              show: row => (auth.reject && canActRow(row) ? 5 : false)
            },
            relatedLogsButton
          ]
        : [
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
                Boolean(
                  auth.cancel && (row.status?.value ?? row.status) === "PENDING"
                )
            },
            relatedLogsButton
          ]
  });

  return {
    operationButtonsProps
  };
}
