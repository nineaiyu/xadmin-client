/**
 * 审批面板勾选列开关：仅待办页签且有任一已授权的批量动作时开启。
 *
 * 只有单行 approve/reject 权限的审批人不应看到可勾选却无批量入口的死交互。
 */
export function approvalSelectionEnabled(
  scope: string,
  auth: Record<string, boolean | undefined>,
  batchCodes: readonly string[]
): boolean {
  return scope === "pending" && batchCodes.some(code => Boolean(auth[code]));
}
