/**
 * 登录日志行操作口径（纯函数，便于单测）：
 *
 * 强退依赖 WS channel（后端 `send_logout_msg` 按 channel 踢线），纯 HTTP 会话
 * 行没有 channel、online 恒为 -1；这类行不再渲染一个点了也无效的禁用按钮，
 * 而是给「会话管理」入口跳到在线会话页（那里支持按 sid 失效 token）。
 */
export type LoginLogRow = {
  online?: boolean | number | null;
  creator?: { pk?: number | string } | null;
};

/** 行内「强退」：仅 WS 在线会话可踢，且需要 logout 权限点 */
export function canForceLogout(
  auth: { logout?: boolean },
  row: LoginLogRow | undefined
): boolean {
  return Boolean(auth.logout && row?.online === true);
}

/** 行内「会话管理」：非 WS 在线行（HTTP 会话/已离线）且能进在线会话页 */
export function showSessionManage(
  canViewOnline: boolean,
  row: LoginLogRow | undefined
): boolean {
  return Boolean(canViewOnline && row?.online !== true);
}

/** 跳在线会话页的查询参数：带上用户主键，落地即筛出该用户全部会话 */
export function onlineSessionsQuery(
  row: LoginLogRow | undefined
): Record<string, string> {
  const creatorId = row?.creator?.pk;
  return creatorId == null || creatorId === ""
    ? {}
    : { creator_id: String(creatorId) };
}

/** 登录策略结果拆解：`action:reason` → 动作与原因，空值返回空动作 */
export function parsePolicyResult(value: unknown): {
  action: string;
  reason: string;
} {
  const text = String(value ?? "").trim();
  if (!text) return { action: "", reason: "" };
  const index = text.indexOf(":");
  if (index < 0) return { action: text, reason: "" };
  return {
    action: text.slice(0, index).trim(),
    reason: text.slice(index + 1).trim()
  };
}
