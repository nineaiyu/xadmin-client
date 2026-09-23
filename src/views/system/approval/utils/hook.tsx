import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/system/approval";
import { SUCCESS_CODE } from "@/api/types";
import {
  handleOperation,
  type OperationButtonsRow,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { statusTagProps } from "@/utils/dict";
import { refreshApprovalBadge } from "@/utils/approvalBadge";
import { refreshApprovalStats } from "@/utils/approvalStats";
import type { RecordType } from "plus-pro-components";
import ApprovalLogsDialog from "../components/ApprovalLogsDialog.vue";
import { APPROVAL_STATUS_TAG_TYPE } from "./constants";
import {
  openApprovalProgressDialog,
  openRejectReasonDialog,
  type TargetSnapshot
} from "./dialogs";
import Check from "~icons/ep/check";
import Close from "~icons/ep/close";
import Document from "~icons/ep/document";
import RefreshLeft from "~icons/ep/refresh-left";

export type ApprovalScope = "pending" | "mine";

/**
 * 审批中心面板公共装配：待我审批 / 我发起的两页签同构，唯一差异是
 * scope 过滤与操作按钮（通过/驳回 vs 撤回）。权限码挂页面组件名
 * SystemApprovalRequest 下（页签无独立菜单，显式传字符串后缀）。
 * 弹窗内容（驳回原因 / 逐级进度）见 utils/dialogs.tsx。
 */
export function useApprovalPanel(scope: ApprovalScope, tableRef: Ref) {
  const componentName = "SystemApprovalRequest";
  const auth = reactive(
    getDefaultAuths(componentName, [
      "approve",
      "reject",
      "cancel",
      "batchApprove",
      "batchReject"
    ])
  );
  const { t } = useI18n();

  /** 互跳抽屉要读操作日志：无该菜单权限时按钮不展示（否则必然 403） */
  const canReadOperationLog = hasAuth("list:SystemOperationLog");

  // 作用域隔离：列表请求按页签追加 scope 参数（后端 ApprovalScopeFilter 收口取值域）
  const api = reactive(
    Object.assign(Object.create(approvalApi), {
      list: (params?: object) =>
        approvalApi.request("get", { scope, ...params }, {})
    })
  );

  /** 列表 + 待办角标 + 顶部统计卡即时刷新（审批动作三者都会变化，不能等下一次轮询） */
  const refresh = () => {
    tableRef.value?.handleGetData();
    refreshApprovalBadge();
    refreshApprovalStats();
  };

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

  /** 批量驳回弹窗：原因必填，逐单校验由服务端收口（部分失败明细逐条提示） */
  const openBatchReject = () => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    openRejectReasonDialog({
      t,
      title: t("approval.batchRejectTitle", { n: pks.length }),
      submit: reason => approvalApi.batchReject(pks, reason),
      onSuccess: res => {
        const failed =
          (res?.data as { failed?: Array<{ no: string; reason: string }> })
            ?.failed ?? [];
        if (failed.length) {
          message(
            t("approval.batchRejectPartial", {
              n: failed.length,
              detail: failed
                .map(item => `${item.no}: ${item.reason}`)
                .join("；")
            }),
            { type: "warning" }
          );
        }
        refresh();
      }
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

  /** 工具栏批量通过（仅待我审批页签，作用于勾选行） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("approval.batchApprove"),
        code: "batchApprove",
        confirm: {
          title: t("approval.batchApproveConfirm")
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
            apiReq: approvalApi.batchApprove(pks),
            success: () => refresh(),
            requestEnd: () => (loading.value = false)
          });
        },
        show: auth.batchApprove
      },
      {
        text: t("approval.batchReject"),
        code: "batchReject",
        props: {
          type: "danger",
          icon: useRenderIcon(Close),
          plain: true
        },
        tooltip: { content: t("approval.batchReject") },
        onClick: () => openBatchReject(),
        show: auth.batchReject
      }
    ]
  });

  /** 多级审批链单：带当前级即「配置到某个人/角色」的逐级审批单（current_level>0） */
  const isChainRow = (row?: RecordType) => Number(row?.current_level ?? 0) > 0;

  /** 行级动作可见性：多级链按服务端 can_act 收口（只有当前级候选人能审），扁平单沿用页面权限 */
  const canActRow = (row?: RecordType) =>
    isChainRow(row) ? Boolean(row?.can_act) : true;

  /** 「审批人」列文案：多级链显示当前级候选人；扁平单显示实际审批人（未处理时占位说明） */
  const approverText = (row?: RecordType) => {
    if (isChainRow(row)) {
      const names = ((row?.current_assignees ?? []) as Array<RecordType>)
        .map(item => item?.username ?? item?.pk)
        .filter(Boolean);
      return `${t("approval.levelNo", { n: row?.current_level })}：${
        names.join("、") || t("approval.pendingApprover")
      }`;
    }
    return row?.approver?.username || t("approval.pendingApprover");
  };

  /** 审批进度弹窗（内容渲染见 utils/dialogs.tsx）：先取详情里的 steps + 目标快照再打开 */
  const openProgress = (row?: RecordType) => {
    if (!row?.pk) return;
    approvalApi.retrieve?.(row.pk)?.then(res => {
      if (res.code !== SUCCESS_CODE || !res.data) return;
      const detail = res.data as RecordType;
      openApprovalProgressDialog({
        t,
        no: String(row.pk).slice(0, 8).toUpperCase(),
        steps: (detail.steps ?? []) as Array<RecordType>,
        // U-1：目标对象变更对照（敏感操作审批的目标快照；缺失时弹窗跳过该区块）
        snapshot: (detail.target_snapshot ?? null) as TargetSnapshot | null
      });
    });
  };

  /** 状态列：字典驱动（approval_status）颜色/文案，字典未配置回退页面 i18n */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          column.cellRenderer = data => {
            const row = data.row;
            const status = row.status?.value ?? row.status;
            return h(
              ElTag,
              statusTagProps(row.status, APPROVAL_STATUS_TAG_TYPE),
              () => row.status?.label ?? t(`approval.status${status}`)
            );
          };
          break;
        // 审批人列：多级链显示「第 N 级：当前级候选人」，扁平单显示实际审批人或
        // 「待审批」占位；两者均可点击查看审批详情（U-1：详情含目标对象变更对照）
        case "approver":
          column.cellRenderer = ({ row }) =>
            h(
              ElLink,
              {
                type: "primary",
                onClick: () => openProgress(row)
              },
              () => approverText(row)
            );
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat
  };
}
