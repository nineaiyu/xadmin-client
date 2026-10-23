/** 我的管辖页的四种视图状态（纯函数，便于单测直测）。 */
export type MyScopeViewState = "denied" | "error" | "empty" | "ready";

/**
 * 状态判定优先级：
 * - 无 `managed:SystemDept` 权限点 → denied（不能再把 403 显示成「暂无管辖部门」）；
 * - 接口失败（403/网络/业务码）→ error（可重试）；
 * - 有权限但确实没有管辖部门 → empty；
 * - 其余 → ready（渲染统计/卡片/层级）。
 */
export function resolveMyScopeState({
  canManaged,
  loadError,
  deptCount
}: {
  canManaged: boolean;
  loadError: string;
  deptCount: number;
}): MyScopeViewState {
  if (!canManaged) return "denied";
  if (loadError) return "error";
  return deptCount > 0 ? "ready" : "empty";
}
