import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type {
  OperationButtonsRow,
  OperationProps
} from "@/components/RePlusPage";
import {
  assignTagsRowButton,
  detailRowButton,
  mineRowButtons,
  pendingRowButtons,
  type InstanceRowButtonDeps
} from "./instanceRowButtons";
import { useInstanceBatchButtons } from "./useInstanceBatchButtons";
import type { InstanceScope } from "./hook";

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
 * 行内按钮组：待办=通过/驳回/加签/减签/退回/转交，我的申请=撤回/催办/重提，
 * 已办=只读（全部在途=催办/打标/申请详情）。
 *
 * 按钮定义见 instanceRowButtons.ts（待办/我的申请/共享）、工具栏见
 * useInstanceBatchButtons、行可见性纯规则见 instanceRowRules.ts。框架按
 * `show` 升序排列，函数形态返回值同样是权重（详见 instanceRowButtons.ts）。
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
  actions: InstanceRowButtonDeps["actions"];
  /** 发起申请成功后的页面级回调（切页签/刷新角标），由 InstancePanel 从父页面透传 */
  onStarted?: () => void;
}) {
  const deps: InstanceRowButtonDeps = {
    t,
    auth,
    refresh,
    actions,
    onStarted
  };
  const detailButton = detailRowButton(deps);
  const { cancelButton, urgeButton, resubmitButton } = mineRowButtons(deps);
  const assignTagsButton = assignTagsRowButton(deps);

  /** 行内按钮：待办=通过/驳回/加签/减签/退回/转交/申请详情；我的申请=撤回/催办/
   *  重提/申请详情；全部在途（管理视角）=催办/打标/申请详情；已办=只读 */
  const buttons: OperationButtonsRow[] =
    scope === "pending"
      ? [...pendingRowButtons(deps), detailButton]
      : scope === "mine"
        ? [cancelButton, urgeButton, resubmitButton, detailButton]
        : scope === "ongoing"
          ? [urgeButton, assignTagsButton, detailButton]
          : [detailButton];

  const operationButtonsProps = shallowRef<OperationProps>({
    // 一屏最多 7 个（待办页签：通过/驳回/加签/减签/退回/转交/申请详情），
    // 再多则按权重把末位折叠进「更多」；
    // 框架内置的 icon 版「查看」由业务「申请详情」承载（同 code="detail" 去重），
    // 这里显式关闭以免出现两个详情入口
    hideDetail: true,
    showNumber: scope === "pending" ? 7 : 5,
    buttons
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
