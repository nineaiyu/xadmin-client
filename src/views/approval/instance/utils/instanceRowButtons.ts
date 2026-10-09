import type { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { hasAuth } from "@/router/utils";
import {
  handleOperation,
  type OperationButtonsRow
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { openInstanceDetail, openStartInstanceDialog } from "./instanceDialogs";
import { hasMyTask, statusValue } from "./instanceRowRules";
import type { InstanceAuth } from "./useInstanceButtons";
import Back from "~icons/ep/back";
import Bell from "~icons/ep/bell";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Minus from "~icons/ep/minus";
import Plus from "~icons/ep/plus";
import Refresh from "~icons/ep/refresh";
import RefreshLeft from "~icons/ep/refresh-left";
import View from "~icons/ep/view";
import Tag from "~icons/ri/price-tag-3-line";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行内按钮装配依赖（动作弹窗与刷新由调用方提供） */
export type InstanceRowButtonDeps = {
  t: TFunction;
  auth: InstanceAuth;
  refresh: () => void;
  actions: {
    openApprove: (row: { pk?: string | number; title?: string }) => void;
    openUrge: (row: { pk?: string | number; title?: string }) => void;
    openReject: (row: { pk?: string | number; title?: string }) => void;
    openAddSign: (row: { pk?: string | number; title?: string }) => void;
    openRemoveSign: (row: { pk?: string | number; title?: string }) => void;
    openReturn: (row: { pk?: string | number; title?: string }) => void;
    openTransfer: (row: { pk?: string | number; title?: string }) => void;
    /** 打标（管理视角）：单对象全量替换语义，权限按 assign:Tag 显示、后端逐对象复核 */
    openAssignTags?: (row: { pk?: string | number }) => void;
    /** 批量动作（工具栏消费，见 useInstanceBatchButtons） */
    openBatchApprove: () => void;
    openBatchReject: () => void;
    openBatchTransfer: () => void;
  };
  /** 发起申请成功后的页面级回调（切页签/刷新角标），由 InstancePanel 从父页面透传 */
  onStarted?: () => void;
};

/** 申请详情：与内置「查看」（通用记录详情）区分，展示表单数据 + 审批轨迹 */
export function detailRowButton(
  deps: InstanceRowButtonDeps
): OperationButtonsRow {
  return {
    text: deps.t("systemApprovalInstance.detailRich"),
    code: "detail",
    props: {
      type: "primary",
      icon: useRenderIcon(View),
      link: true
    },
    onClick: ({ row }) => openInstanceDetail(row),
    index: 9,
    show: true
  };
}

/** 打标（管理视角）：给在途实例打分类标签（如「加急」），走通用打标弹窗 */
export function assignTagsRowButton(
  deps: InstanceRowButtonDeps
): OperationButtonsRow {
  return {
    text: deps.t("tag.assignTitle"),
    code: "assignTags",
    props: {
      type: "warning",
      icon: useRenderIcon(Tag),
      link: true
    },
    onClick: ({ row }) => deps.actions.openAssignTags?.(row),
    show: Boolean(deps.actions.openAssignTags) && hasAuth("assign:Tag")
  };
}

/**
 * 待办页签行内按钮（顺序权重即 show 升序，避免行级条件按钮并列在最前）：
 * 通过 1 / 驳回 2 / 加签 3 / 减签 4 / 退回 5 / 转交 6；加签类仅有我的当前待办时可用。
 */
export function pendingRowButtons(
  deps: InstanceRowButtonDeps
): OperationButtonsRow[] {
  const { t, auth } = deps;
  const approveButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.approve"),
    code: "approve",
    props: {
      type: "primary",
      icon: useRenderIcon(Check),
      link: true
    },
    // 通过走弹窗：审批意见选填（随任务落轨迹；后端 comment 字段同口径）
    onClick: ({ row }) => deps.actions.openApprove(row),
    index: 1,
    show: auth.approve
  };

  const rejectButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.reject"),
    code: "reject",
    props: {
      type: "danger",
      icon: useRenderIcon(Close),
      link: true
    },
    onClick: ({ row }) => deps.actions.openReject(row),
    index: 2,
    show: auth.reject
  };

  const addSignButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.addSign"),
    code: "addSign",
    props: {
      type: "warning",
      icon: useRenderIcon(Plus),
      link: true
    },
    onClick: ({ row }) => deps.actions.openAddSign(row),
    // 仅有我的当前待办时可用（或签节点会被服务端以可读原因拒绝并引导转交）
    index: 3,
    show: (row: { my_task?: unknown }) => auth.addSign && hasMyTask(row)
  };

  /** 减签：移除加签追加的候选（弹窗内选人；或签节点由服务端拒绝引导转交） */
  const removeSignButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.removeSign"),
    code: "removeSign",
    props: {
      type: "warning",
      icon: useRenderIcon(Minus),
      link: true
    },
    onClick: ({ row }) => deps.actions.openRemoveSign(row),
    index: 4,
    show: (row: { my_task?: unknown }) => auth.removeSign && hasMyTask(row)
  };

  /** 退回：实例回退到已途经节点重开重审（区别于驳回即终止） */
  const returnButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.return"),
    code: "returnNode",
    props: {
      type: "danger",
      icon: useRenderIcon(Back),
      link: true
    },
    onClick: ({ row }) => deps.actions.openReturn(row),
    index: 5,
    show: (row: { my_task?: unknown }) => auth.returnNode && hasMyTask(row)
  };

  /** 转交：把我的当前待办交给他人处理（一次性，区别于长期委托） */
  const transferButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.transfer"),
    code: "transfer",
    props: {
      type: "warning",
      icon: useRenderIcon(Refresh),
      link: true
    },
    onClick: ({ row }) => deps.actions.openTransfer(row),
    index: 6,
    show: (row: { my_task?: unknown }) => auth.transfer && hasMyTask(row)
  };

  return [
    approveButton,
    rejectButton,
    addSignButton,
    removeSignButton,
    returnButton,
    transferButton
  ];
}

/**
 * 我的申请页签行内按钮：撤回 6 / 催办 7 / 重新提交 8。
 * 撤回与催办仅审批中可用；重提仅已驳回可用（沿用原流程与原表单内容）。
 */
export function mineRowButtons(deps: InstanceRowButtonDeps): {
  cancelButton: OperationButtonsRow;
  urgeButton: OperationButtonsRow;
  resubmitButton: OperationButtonsRow;
} {
  const { t, auth, refresh, onStarted } = deps;

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
    index: 6,
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
    onClick: ({ row }) => deps.actions.openUrge(row),
    index: 7,
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
    index: 8,
    show: (row: { status?: { value?: string } | string }) =>
      auth.create && statusValue(row) === "REJECTED"
  };

  return { cancelButton, urgeButton, resubmitButton };
}
