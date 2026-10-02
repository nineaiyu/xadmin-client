import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type {
  OperationButtonsRow,
  OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { openStartInstanceDialog } from "./instanceDialogs";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import type { InstanceAuth } from "./useInstanceButtons";
import type { InstanceScope } from "./hook";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 审批实例工具栏按钮：发起申请（所有页签首位）+ 批量通过/驳回/转交（仅待办页签）。
 * 自 useInstanceButtons 拆出（行为不变）：导出由框架按 auth.exportData 内建。
 */
export function useInstanceBatchButtons({
  scope,
  auth,
  t,
  refresh,
  actions,
  onStarted
}: {
  scope: InstanceScope;
  auth: InstanceAuth;
  t: TFunction;
  refresh: () => void;
  actions: {
    openBatchApprove: () => void;
    openBatchReject: () => void;
    openBatchTransfer: () => void;
  };
  /** 发起申请成功后的页面级回调（切页签/刷新角标），由 InstancePanel 从父页面透传 */
  onStarted?: () => void;
}) {
  /** 工具栏「发起申请」：所有页签首位（选流程 + 动态表单；成功后页面切页签/刷新角标） */
  const startButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.start"),
    code: "create",
    props: {
      type: "primary",
      icon: useRenderIcon(Plus)
    },
    onClick: () => {
      openStartInstanceDialog(t("systemApprovalInstance.startTitle"), () => {
        refresh();
        onStarted?.();
      });
    },
    show: auth.create
  };

  const batchApproveButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.batchApprove"),
    code: "batchApprove",
    props: {
      type: "primary",
      icon: useRenderIcon(Check),
      plain: true
    },
    // 批量通过走弹窗：审批意见选填（逐单落同一意见）
    onClick: () => actions.openBatchApprove(),
    show: auth.batchApprove
  };

  const batchRejectButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.batchReject"),
    code: "batchReject",
    props: {
      type: "danger",
      icon: useRenderIcon(Close),
      plain: true
    },
    onClick: () => actions.openBatchReject(),
    show: auth.batchReject
  };

  /** 批量转交（待办页签）：勾选的多条待办一次交给同一人（区别于逐条转交） */
  const batchTransferButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.batchTransfer"),
    code: "batchTransfer",
    props: {
      type: "warning",
      icon: useRenderIcon(Refresh),
      plain: true
    },
    onClick: () => actions.openBatchTransfer(),
    show: auth.batchTransfer
  };

  /** 工具栏：发起申请（所有页签）+ 批量（仅待办页签；导出由框架按 auth.exportData 内建） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      startButton,
      ...(scope === "pending"
        ? [batchApproveButton, batchRejectButton, batchTransferButton]
        : [])
    ]
  });

  return {
    tableBarButtonsProps
  };
}
