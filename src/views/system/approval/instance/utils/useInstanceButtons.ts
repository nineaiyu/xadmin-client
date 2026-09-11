import { shallowRef, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { openInstanceDetail } from "./instanceDialogs";
import type { InstanceScope } from "./hook";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Plus from "~icons/ep/plus";
import RefreshLeft from "~icons/ep/refresh-left";
import View from "~icons/ep/view";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 面板权限集合（hook 组装入口 reactive 声明的形状，真实取值由 getDefaultAuths 覆盖） */
export type InstanceAuth = {
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  addSign: boolean;
  batchApprove: boolean;
  batchReject: boolean;
  create: boolean;
};

/** 行内/工具栏按钮组：待办=通过/驳回/加签，我的申请=撤回，已办=只读（拆分自 hook.tsx，行为不变） */
export function useInstanceButtons({
  scope,
  auth,
  t,
  refresh,
  tableRef,
  actions
}: {
  scope: InstanceScope;
  auth: InstanceAuth;
  t: TFunction;
  refresh: () => void;
  tableRef: Ref;
  actions: {
    openReject: (row: { pk?: string | number; title?: string }) => void;
    openAddSign: (row: { pk?: string | number; title?: string }) => void;
    openBatchReject: () => void;
  };
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
    confirm: {
      title: (row: { title?: string }) =>
        t("systemApprovalInstance.approveConfirm", {
          title: row?.title ?? ""
        })
    },
    onClick: ({ row, loading }) => {
      loading.value = true;
      handleOperation({
        t,
        apiReq: approvalInstanceApi.approve(row.pk, row.my_task?.pk),
        success: () => refresh(),
        requestEnd: () => (loading.value = false)
      });
    },
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
    show: auth.addSign && 4
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
      auth.cancel &&
      ((row.status as { value?: string })?.value ?? row.status) === "PENDING"
  };

  /** 行内按钮：待办=通过/驳回/加签；我的申请=撤回；已办/详情=只读 */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 5 个按钮（内置查看 + 通过/驳回/加签/申请详情）全部内联，避免折叠进「更多」
    showNumber: 5,
    buttons:
      scope === "pending"
        ? [approveButton, rejectButton, addSignButton, detailButton]
        : scope === "mine"
          ? [cancelButton, detailButton]
          : [detailButton]
  });

  /** 工具栏批量（仅待办页签） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons:
      scope === "pending"
        ? [
            {
              text: t("systemApprovalInstance.batchApprove"),
              code: "batchApprove",
              confirm: {
                title: t("systemApprovalInstance.batchApproveConfirm")
              },
              props: {
                type: "primary",
                icon: useRenderIcon(Check),
                plain: true
              },
              onClick: ({ loading }) => {
                const pks = tableRef.value?.getSelectPks("pk") ?? [];
                if (!pks.length) {
                  message(t("results.noSelectedData"), { type: "error" });
                  return;
                }
                loading.value = true;
                handleOperation({
                  t,
                  apiReq: approvalInstanceApi.batchApprove(pks),
                  success: () => refresh(),
                  requestEnd: () => (loading.value = false)
                });
              },
              show: auth.batchApprove
            },
            {
              text: t("systemApprovalInstance.batchReject"),
              code: "batchReject",
              props: {
                type: "danger",
                icon: useRenderIcon(Close),
                plain: true
              },
              onClick: () => actions.openBatchReject(),
              show: auth.batchReject
            }
          ]
        : []
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
