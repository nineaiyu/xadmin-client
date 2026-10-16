import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { approvalApi } from "@/api/approval/approval";
import { refreshApprovalBadge } from "@/utils/approvalBadge";
import { refreshApprovalStats } from "@/utils/approvalStats";
import { useApprovalColumns } from "./approvalColumns";
import { useApprovalProgress } from "./useApprovalProgress";
import { useApprovalRowActions } from "./useApprovalRowActions";
import { useApprovalToolbar } from "./useApprovalToolbar";

export type ApprovalScope = "pending" | "mine";

/**
 * 审批中心面板公共装配：待我审批 / 我发起的两页签同构，唯一差异是
 * scope 过滤与操作按钮（通过/驳回 vs 撤回）。权限码挂页面组件名
 * SystemApprovalRequest 下（页签无独立菜单，显式传字符串后缀）。
 * 弹窗内容（驳回原因 / 逐级进度）见 utils/dialogs.tsx；行内操作与工具栏见
 * useApprovalRowActions / useApprovalToolbar，列渲染见 approvalColumns，
 * 进度弹窗入口见 useApprovalProgress；行级可见性与文案规则见
 * approvalRowRules / approvalTexts（纯函数可单测直测）。
 */
export function useApprovalPanel(scope: ApprovalScope, tableRef: Ref) {
  const auth = usePageAuth("SystemApprovalRequest", [
    "approve",
    "reject",
    "cancel",
    "batchApprove",
    "batchReject"
  ]);
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

  const { openProgress } = useApprovalProgress();
  const { listColumnsFormat } = useApprovalColumns({ t, openProgress });

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat
  };
}
