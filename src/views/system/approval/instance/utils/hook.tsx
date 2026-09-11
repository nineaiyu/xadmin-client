import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { getDefaultAuths } from "@/router/utils";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import { useInstanceActions } from "./useInstanceActions";
import { useInstanceButtons } from "./useInstanceButtons";
import { useInstanceColumnFormats } from "./useInstanceColumnFormats";

export type InstanceScope = "pending" | "mine" | "done";

// 页面级复用入口（index.vue / 面板按钮经此导入，保持原导出路径不变）
export { openStartInstanceDialog, openInstanceDetail } from "./instanceDialogs";

/**
 * 流程审批面板公共装配（待我审批 / 我的申请 / 已办三页签同构；拆分自 493 行单体）：
 * - useInstanceActions        审批动作弹窗（驳回/加签/批量驳回）
 * - useInstanceButtons        行内/工具栏按钮组
 * - useInstanceColumnFormats  状态列与当前节点列渲染
 * - instanceDialogs           发起申请弹窗与详情抽屉（页面级复用）
 * 返回值形状与拆分前一致（InstancePanel.vue 无需改动）。
 *
 * 唯一差异：scope 过滤（后端 ApprovalInstanceScopeFilter 收口取值域）与行内
 * 操作按钮；权限码挂页面组件名 SystemApprovalInstance 下。
 */
export function useInstancePanel(scope: InstanceScope, tableRef: Ref) {
  const componentName = "SystemApprovalInstance";
  const baseAuth = getDefaultAuths(componentName, [
    "approve",
    "reject",
    "cancel",
    "addSign",
    "batchApprove",
    "batchReject"
  ]);
  // 自定义权限码先声明默认值再展开（与 demo/book、system/role 同范式）：
  // UnwrapNestedRefs 会丢掉索引签名，不显式声明时 auth.approve 等取用会报 TS2339；
  // 展开在后保证 hasAuth 的真实取值覆盖默认值
  const auth = reactive({
    approve: false,
    reject: false,
    cancel: false,
    addSign: false,
    batchApprove: false,
    batchReject: false,
    ...baseAuth,
    // 隐藏内置「新增」入口：发起申请由页面顶部的专用按钮承载（弹窗内选流程 + 动态表单）
    create: false
  });
  const { t } = useI18n();

  // 作用域隔离：列表请求按页签追加 scope 参数
  const api = reactive(
    Object.assign(Object.create(approvalInstanceApi), {
      list: (params?: object) =>
        approvalInstanceApi.request("get", { scope, ...params }, {})
    })
  );

  const refresh = () => tableRef.value?.handleGetData();

  const { listColumnsFormat } = useInstanceColumnFormats({ t });
  const { openReject, openAddSign, openBatchReject } = useInstanceActions({
    t,
    refresh,
    tableRef
  });
  const { operationButtonsProps, tableBarButtonsProps } = useInstanceButtons({
    scope,
    auth,
    t,
    refresh,
    tableRef,
    actions: { openReject, openAddSign, openBatchReject }
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
