/**
 * 审批统计刷新器注册表（与 utils/approvalBadge.ts 同构）。
 *
 * 背景：审批中心页面上方的统计卡（ApprovalStats）自发起请求；审批动作
 * （通过/驳回/批量/撤回）分散在各页面与弹窗内，成功后若只刷新列表与角标，
 * 统计卡会停留在旧值（用户操作后看到的「我通过/待我审批」不更新）。
 *
 * 解法：统计卡挂载时把自身的拉取函数注册到模块级注册表，审批动作成功后
 * 由 `refreshApprovalStats()` 触发全部展示中的统计卡刷新——操作位置无需
 * 逐层透传 ref，新增审批入口只要调用一次即可覆盖。
 */
const refreshers = new Set<() => void>();

/** 注册刷新器（组件卸载时调用返回的注销函数；同组件重复注册会覆盖同一函数引用） */
export function registerApprovalStatsRefresh(refresher: () => void) {
  refreshers.add(refresher);
  return () => refreshers.delete(refresher);
}

/** 审批动作成功后的即时刷新（页面上无统计卡挂载时为空操作） */
export function refreshApprovalStats() {
  refreshers.forEach(refresher => refresher());
}
