export type ApprovalResourceTab = {
  path: string;
  labelKey: string;
  authCode: string;
};

/** 审批中心的两套资源入口：操作审批（令牌）与流程审批（引擎），资源独立、入口统一。 */
export const APPROVAL_RESOURCE_TABS: ApprovalResourceTab[] = [
  {
    path: "/approval/index",
    labelKey: "menus.approvalCenter",
    authCode: "list:SystemApprovalRequest"
  },
  {
    path: "/approval/instance/index",
    labelKey: "menus.approvalInstance",
    authCode: "list:SystemApprovalInstance"
  }
];

export function visibleApprovalResourceTabs(
  hasAuth: (code: string) => boolean
): ApprovalResourceTab[] {
  return APPROVAL_RESOURCE_TABS.filter(tab => hasAuth(tab.authCode));
}
