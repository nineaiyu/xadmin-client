import { hasAuth } from "@/router/utils";

/**
 * 列表勾选列是否展示：框架批删或任一页面批量动作有权限。
 * 只有批量动作权限（无 batchDestroy）时也必须能勾选，否则按钮永远拿不到行。
 */
export function hasBatchSelection(
  auth: Record<string, boolean | undefined>,
  permissionCodes: readonly string[]
): boolean {
  return (
    Boolean(auth.batchDestroy) || permissionCodes.some(code => hasAuth(code))
  );
}
