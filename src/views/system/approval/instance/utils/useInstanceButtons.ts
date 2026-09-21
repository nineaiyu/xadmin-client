import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { openInstanceDetail, openStartInstanceDialog } from "./instanceDialogs";
import type { InstanceScope } from "./hook";
import Bell from "~icons/ep/bell";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import RefreshLeft from "~icons/ep/refresh-left";
import View from "~icons/ep/view";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 面板权限集合（hook 组装入口 reactive 声明的形状，真实取值由 getDefaultAuths 覆盖） */
export type InstanceAuth = {
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  urge: boolean;
  addSign: boolean;
  transfer: boolean;
  ongoing: boolean;
  batchApprove: boolean;
  batchReject: boolean;
  batchTransfer: boolean;
  create: boolean;
  /** 导出走框架内建按钮（auth.exportData 控制显示），此处仅声明形状 */
  exportData: boolean;
};

/** 行数据是否含「我的当前待办」（服务端 my_task 口径：仅当前节点、指派给我、审批中） */
const hasMyTask = (row: { my_task?: unknown }) => !!row.my_task;

const statusValue = (row: { status?: { value?: string } | string }) =>
  (row.status as { value?: string })?.value ?? row.status;

/** 行内/工具栏按钮组：待办=通过/驳回/加签，我的申请=撤回/催办/重提，已办=只读 */
export function useInstanceButtons({
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
    openApprove: (row: { pk?: string | number; title?: string }) => void;
    openBatchApprove: () => void;
    openUrge: (row: { pk?: string | number; title?: string }) => void;
    openReject: (row: { pk?: string | number; title?: string }) => void;
    openAddSign: (row: { pk?: string | number; title?: string }) => void;
    openTransfer: (row: { pk?: string | number; title?: string }) => void;
    openBatchTransfer: () => void;
    openBatchReject: () => void;
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

  const detailButton: OperationButtonsRow = {
    // 与内置「查看」（通用记录详情）区分：本按钮展示表单数据 + 审批轨迹
    text: t("systemApprovalInstance.detailRich"),
    code: "detail",
    props: {
      type: "primary",
      icon: useRenderIcon(View),
      link: true
    },
    onClick: ({ row }) => openInstanceDetail(row),
    show: 10
  };

  const approveButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.approve"),
    code: "approve",
    props: {
      type: "primary",
      icon: useRenderIcon(Check),
      link: true
    },
    // 通过走弹窗：审批意见选填（随任务落轨迹；后端 comment 字段同口径）
    onClick: ({ row }) => actions.openApprove(row),
    show: auth.approve && 6
  };

  const rejectButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.reject"),
    code: "reject",
    props: {
      type: "danger",
      icon: useRenderIcon(Close),
      link: true
    },
    onClick: ({ row }) => actions.openReject(row),
    show: auth.reject && 5
  };

  const addSignButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.addSign"),
    code: "addSign",
    props: {
      type: "warning",
      icon: useRenderIcon(Plus),
      link: true
    },
    onClick: ({ row }) => actions.openAddSign(row),
    // 仅有我的当前待办时可用（或签节点会被服务端以可读原因拒绝并引导转交）
    show: (row: { my_task?: unknown }) => auth.addSign && hasMyTask(row) && 4
  };

  /** 转交（待办页签）：把我的当前待办交给他人处理（一次性，区别于长期委托） */
  const transferButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.transfer"),
    code: "transfer",
    props: {
      type: "warning",
      icon: useRenderIcon(Refresh),
      link: true
    },
    onClick: ({ row }) => actions.openTransfer(row),
    show: (row: { my_task?: unknown }) => auth.transfer && hasMyTask(row) && 3
  };

  const cancelButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.cancel"),
    code: "cancel",
    props: {
      type: "info",
      icon: useRenderIcon(RefreshLeft),
      link: true
    },
    confirm: {
      title: (row: { title?: string }) =>
        t("systemApprovalInstance.cancelConfirm", { title: row?.title ?? "" })
    },
    onClick: ({ row, loading }) => {
      loading.value = true;
      handleOperation({
        t,
        apiReq: approvalInstanceApi.cancel(row.pk),
        success: () => refresh(),
        requestEnd: () => (loading.value = false)
      });
    },
    show: (row: { status?: { value?: string } | string }) =>
      auth.cancel && statusValue(row) === "PENDING"
  };

  /** 催办（我的申请页签）：审批中才可用，通知当前节点审批人（服务端 10 分钟节流） */
  const urgeButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.urge"),
    code: "urge",
    props: {
      type: "warning",
      icon: useRenderIcon(Bell),
      link: true
    },
    onClick: ({ row }) => actions.openUrge(row),
    show: (row: { status?: { value?: string } | string }) =>
      auth.urge && statusValue(row) === "PENDING"
  };

  /** 重新提交（我的申请页签）：已驳回时按原流程与原表单内容发起新申请 */
  const resubmitButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.resubmit"),
    code: "resubmit",
    props: {
      type: "primary",
      icon: useRenderIcon(Refresh),
      link: true
    },
    confirm: {
      title: (row: { title?: string }) =>
        t("systemApprovalInstance.resubmitConfirm", {
          title: row?.title ?? ""
        })
    },
    onClick: ({ row }) => {
      const flowPk = (row.flow as { pk?: string | number } | undefined)?.pk;
      if (!flowPk) {
        message(t("results.failed"), { type: "error" });
        return;
      }
      openStartInstanceDialog(
        t("systemApprovalInstance.startTitle"),
        () => {
          refresh();
          onStarted?.();
        },
        {
          flow: String(flowPk),
          title: row.title,
          formData: (row.form_data ?? {}) as Record<string, unknown>
        }
      );
    },
    show: (row: { status?: { value?: string } | string }) =>
      auth.create && statusValue(row) === "REJECTED"
  };

  /** 行内按钮：待办=通过/驳回/加签/转交；我的申请=撤回/催办/重提；
   *  全部在途（管理视角）=催办/详情；已办=只读 */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 按钮全部内联（内置查看 + 业务动作），避免折叠进「更多」
    showNumber: 6,
    buttons:
      scope === "pending"
        ? [
            approveButton,
            rejectButton,
            addSignButton,
            transferButton,
            detailButton
          ]
        : scope === "mine"
          ? [cancelButton, urgeButton, resubmitButton, detailButton]
          : scope === "ongoing"
            ? [urgeButton, detailButton]
            : [detailButton]
  });

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

  return { operationButtonsProps, tableBarButtonsProps };
}
