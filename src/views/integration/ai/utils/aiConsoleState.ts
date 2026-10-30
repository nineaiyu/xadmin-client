/** AI 控制台是否可发送消息：状态接口不可用时只授 ask 的角色仍可提问。 */
export function resolveAiConsoleReady(
  status: { enabled: boolean; configured: boolean } | null,
  canUse: boolean
): boolean {
  if (status) return Boolean(status.enabled && status.configured);
  return canUse;
}
