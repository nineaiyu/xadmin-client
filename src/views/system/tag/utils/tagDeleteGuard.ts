import type { RecordType } from "plus-pro-components";

/**
 * 标签删除入口显隐：内置标签与已被引用的标签点删除必然失败，
 * 直接在 UI 层隐藏；后端仍保留同样的拒绝兜底（并发引用 / 绕过 UI）。
 */
export function canDeleteTag(
  row: RecordType | undefined,
  canDestroy: boolean
): boolean {
  if (!row || !canDestroy) return false;
  return !row.builtin && !Number(row.usage_count ?? 0);
}
