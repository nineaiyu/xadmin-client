import { h, reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { getDefaultAuths } from "@/router/utils";
import { approvalApi } from "@/api/approval/approval";
import { SUCCESS_CODE } from "@/api/types";
import {
  type PageTableColumn,
  formatPageColumns
} from "@/components/RePlusPage";
import { statusTagProps } from "@/utils/dict";
import { refreshApprovalBadge } from "@/utils/approvalBadge";
import { refreshApprovalStats } from "@/utils/approvalStats";
import type { RecordType } from "plus-pro-components";
import { APPROVAL_STATUS_TAG_TYPE } from "./constants";
import { openApprovalProgressDialog, type TargetSnapshot } from "./dialogs";
import { useApprovalRowActions } from "./useApprovalRowActions";
import { useApprovalToolbar } from "./useApprovalToolbar";
import { approverText } from "./approvalTexts";

export type ApprovalScope = "pending" | "mine";

/**
 * 审批中心面板公共装配：待我审批 / 我发起的两页签同构，唯一差异是
 * scope 过滤与操作按钮（通过/驳回 vs 撤回）。权限码挂页面组件名
 * SystemApprovalRequest 下（页签无独立菜单，显式传字符串后缀）。
 * 弹窗内容（驳回原因 / 逐级进度）见 utils/dialogs.tsx；
 * 行内操作与工具栏见 useApprovalRowActions / useApprovalToolbar，
 * 行级可见性与文案规则见 approvalRowRules / approvalTexts（纯函数可单测直测）。
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

  // 行内操作（通过/驳回/撤回/互跳日志）与工具栏批量动作
  const { operationButtonsProps } = useApprovalRowActions({
    scope,
    auth,
    refresh
  });
  const { tableBarButtonsProps } = useApprovalToolbar({
    auth,
    tableRef,
    refresh
  });

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
        // 目标对象变更对照（敏感操作审批的目标快照；缺失时弹窗跳过该区块）
        snapshot: (detail.target_snapshot ?? null) as TargetSnapshot | null
      });
    });
  };

  /** 状态列：字典驱动（approval_status）颜色/文案，字典未配置回退页面 i18n */
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      status: column => {
        column.cellRenderer = data => {
          const row = data.row;
          const status = row.status?.value ?? row.status;
          return h(
            ElTag,
            statusTagProps(row.status, APPROVAL_STATUS_TAG_TYPE),
            () => row.status?.label ?? t(`approval.status${status}`)
          );
        };
      },
      // 审批人列：多级链显示「第 N 级：当前级候选人」，扁平单显示实际审批人或
      // 「待审批」占位（文案规则见 approvalTexts.ts）；两者均可点击查看审批详情
      // （详情含目标对象变更对照）
      approver: column => {
        column.cellRenderer = ({ row }) =>
          h(
            ElLink,
            {
              type: "primary",
              onClick: () => openProgress(row)
            },
            () => approverText(row, t)
          );
      }
    });

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat
  };
}
