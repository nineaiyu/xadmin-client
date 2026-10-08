import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { hasAuth } from "@/router/utils";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { openInstanceDetail, openStartInstanceDialog } from "./instanceDialogs";
import { hasMyTask, statusValue } from "./instanceRowRules";
import { useInstanceBatchButtons } from "./useInstanceBatchButtons";
import type { InstanceScope } from "./hook";
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

/** 面板权限集合（hook 组装入口 reactive 声明的形状，真实取值由 getDefaultAuths 覆盖） */
export type InstanceAuth = {
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  urge: boolean;
  addSign: boolean;
  removeSign: boolean;
  returnNode: boolean;
  transfer: boolean;
  ongoing: boolean;
  batchApprove: boolean;
  batchReject: boolean;
  batchTransfer: boolean;
  create: boolean;
  /** 导出走框架内建按钮（auth.exportData 控制显示），此处仅声明形状 */
  exportData: boolean;
};

/**
 * 行内按钮组：待办=通过/驳回/加签/减签/退回/转交，我的申请=撤回/催办/重提，已办=只读。
 *
 * 按钮顺序权重（`show` 的角色）：框架按 `show` 升序排列，函数形态的返回值同样是
 * 权重（`Number(true) = 1`，一律返回布尔会让所有行级条件按钮并列在最前）。
 * 口径：通过 1 / 驳回 2 / 加签 3 / 减签 4 / 转交 5 / 撤回 6 / 催办 7 / 重提 8 / 详情 9。
 * （工具栏按钮见 useInstanceBatchButtons；行可见性纯规则见 instanceRowRules.ts。）
 */
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
    openRemoveSign: (row: { pk?: string | number; title?: string }) => void;
    openReturn: (row: { pk?: string | number; title?: string }) => void;
    openTransfer: (row: { pk?: string | number; title?: string }) => void;
    openBatchTransfer: () => void;
    openBatchReject: () => void;
    /** 打标（管理视角）：单对象全量替换语义，权限按 assign:Tag 显示、后端逐对象复核 */
    openAssignTags?: (row: { pk?: string | number }) => void;
  };
  /** 发起申请成功后的页面级回调（切页签/刷新角标），由 InstancePanel 从父页面透传 */
  onStarted?: () => void;
}) {
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
    show: 9
  };

  /** 打标（管理视角）：给在途实例打分类标签（如「加急」），走通用打标弹窗 */
  const assignTagsButton: OperationButtonsRow = {
    text: t("tag.assignTitle"),
    code: "assignTags",
    props: {
      type: "warning",
      icon: useRenderIcon(Tag),
      link: true
    },
    onClick: ({ row }) => actions.openAssignTags?.(row),
    show: Boolean(actions.openAssignTags) && hasAuth("assign:Tag")
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
    onClick: ({ row }) => actions.openReject(row),
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
    onClick: ({ row }) => actions.openAddSign(row),
    // 仅有我的当前待办时可用（或签节点会被服务端以可读原因拒绝并引导转交）
    index: 3,
    show: (row: { my_task?: unknown }) => auth.addSign && hasMyTask(row)
  };

  /** 减签（待办页签）：移除加签追加的候选（弹窗内选人；或签节点由服务端拒绝引导转交） */
  const removeSignButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.removeSign"),
    code: "removeSign",
    props: {
      type: "warning",
      icon: useRenderIcon(Minus),
      link: true
    },
    onClick: ({ row }) => actions.openRemoveSign(row),
    index: 4,
    show: (row: { my_task?: unknown }) => auth.removeSign && hasMyTask(row)
  };

  /** 退回（待办页签）：实例回退到已途经节点重开重审（区别于驳回即终止） */
  const returnButton: OperationButtonsRow = {
    text: t("systemApprovalInstance.return"),
    code: "returnNode",
    props: {
      type: "danger",
      icon: useRenderIcon(Back),
      link: true
    },
    onClick: ({ row }) => actions.openReturn(row),
    index: 5,
    show: (row: { my_task?: unknown }) => auth.returnNode && hasMyTask(row)
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
    index: 6,
    show: (row: { my_task?: unknown }) => auth.transfer && hasMyTask(row)
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
    onClick: ({ row }) => actions.openUrge(row),
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

  /** 行内按钮：待办=通过/驳回/加签/转交；我的申请=撤回/催办/重提；
   *  全部在途（管理视角）=催办/打标/详情；已办=只读 */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 一屏最多 7 个（待办页签：通过/驳回/加签/减签/退回/转交/申请详情），
    // 再多则按权重把末位折叠进「更多」；
    // 框架内置的 icon 版「查看」由业务「申请详情」承载（同 code="detail" 去重），
    // 这里显式关闭以免出现两个详情入口
    hideDetail: true,
    showNumber: scope === "pending" ? 7 : 5,
    buttons:
      scope === "pending"
        ? [
            approveButton,
            rejectButton,
            addSignButton,
            removeSignButton,
            returnButton,
            transferButton,
            detailButton
          ]
        : scope === "mine"
          ? [cancelButton, urgeButton, resubmitButton, detailButton]
          : scope === "ongoing"
            ? [urgeButton, assignTagsButton, detailButton]
            : [detailButton]
  });

  // 工具栏：发起申请 + 待办页签批量动作
  const { tableBarButtonsProps } = useInstanceBatchButtons({
    scope,
    auth,
    t,
    refresh,
    actions,
    onStarted
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
