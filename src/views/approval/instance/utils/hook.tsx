import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import { refreshApprovalBadge } from "@/utils/approvalBadge";
import { refreshApprovalStats } from "@/utils/approvalStats";
import { useInstanceActions } from "./useInstanceActions";
import { useInstanceButtons } from "./useInstanceButtons";
import { useInstanceColumnFormats } from "./useInstanceColumnFormats";
import { useTagAssign } from "@/views/system/components/useTagAssign";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";

/** 页签取值域；ongoing = 全部在途（管理视角，按 ongoing 权限点显示） */
export type InstanceScope = "pending" | "mine" | "done" | "ongoing";

// 页面级复用入口（index.vue / 面板按钮经此导入，保持原导出路径不变）
export { openStartInstanceDialog, openInstanceDetail } from "./instanceDialogs";

/**
 * 流程审批面板公共装配（待我审批 / 我的申请 / 已办 / 全部在途四页签同构）：
 * 审批动作弹窗（useInstanceActions）、按钮组（useInstanceButtons）、列渲染
 * （useInstanceColumnFormats）与发起/详情弹层（instanceDialogs 页面级复用）；
 * 返回值形状与拆分前一致（InstancePanel.vue 无需改动）。唯一差异：scope 过滤
 * （后端 ApprovalInstanceScopeFilter 收口取值域）与行内操作按钮；权限码挂页面
 * 组件名 SystemApprovalInstance 下。
 */
export function useInstancePanel(
  scope: InstanceScope,
  tableRef: Ref,
  onStarted?: () => void
) {
  const auth = usePageAuth("SystemApprovalInstance", [
    "approve",
    "reject",
    "cancel",
    "urge",
    "addSign",
    "removeSign",
    "returnNode",
    "transfer",
    "ongoing",
    "batchApprove",
    "batchReject",
    "batchTransfer",
    "create",
    // 导出按钮由框架内建（usePlusPageButtons 读 auth.exportData 决定显示与异步开关）
    "exportData"
  ]);
  const { t } = useI18n();

  // 作用域隔离：列表请求按页签追加 scope 参数
  const api = reactive(
    Object.assign(Object.create(approvalInstanceApi), {
      list: (params?: object) =>
        approvalInstanceApi.request("get", { scope, ...params }, {})
    })
  );

  /**
   * 列表 + 待办角标 + 顶部统计卡即时刷新：审批动作（通过/驳回/加签/转办…）
   * 三者都会变化，不能等 60s 轮询或下次进入页面
   */
  const refresh = () => {
    tableRef.value?.handleGetData();
    refreshApprovalBadge();
    refreshApprovalStats();
  };

  const { listColumnsFormat } = useInstanceColumnFormats({ t });
  const {
    openApprove,
    openBatchApprove,
    openUrge,
    openReject,
    openAddSign,
    openRemoveSign,
    openReturn,
    openTransfer,
    openBatchTransfer,
    openBatchReject
  } = useInstanceActions({ t, refresh, tableRef });
  // 通用标签（管理视角行内打标）：单对象全量替换，成功后由弹窗刷新当前表格
  const { openTagDialog } = useTagAssign(tableRef);
  const { operationButtonsProps, tableBarButtonsProps } = useInstanceButtons({
    scope,
    auth,
    t,
    refresh,
    actions: {
      openApprove,
      openBatchApprove,
      openUrge,
      openReject,
      openAddSign,
      openRemoveSign,
      openReturn,
      openTransfer,
      openBatchTransfer,
      openBatchReject,
      openAssignTags: target =>
        openTagDialog({
          resource: TAGGABLE_RESOURCE.approvalInstance,
          row: target as Record<string, unknown>
        })
    },
    onStarted
  });

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat,
    refresh
  };
}
