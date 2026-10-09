import type { TableColumnLike } from "./utils";
import type { TablePrefs } from "./tablePrefsStorage";

const labelOf = (column: TableColumnLike) =>
  typeof column?.label === "string" ? column.label : "";

/**
 * 应用已保存偏好（自 useTablePrefs.ts 抽出）：无偏好时零变化；
 * 列用 label（i18n key）作为稳定标识——切换语言不改偏好，列被删除或无 label
 * 的列静默忽略。返回偏好中的密度（调用方写回 ref）。
 */
export function applyTablePrefs(
  saved: TablePrefs,
  columns: TableColumnLike[]
): { size?: string } {
  if (!columns?.length) return {};
  if (Array.isArray(saved.hidden)) {
    columns.forEach(column => {
      const label = labelOf(column);
      if (!label) return;
      column.hide = saved.hidden?.includes(label) ?? false;
    });
  }
  if (Array.isArray(saved.order) && saved.order.length) {
    const rank = new Map(saved.order.map((label, index) => [label, index]));
    const sorted = [...columns].sort((left, right) => {
      const leftRank = rank.get(labelOf(left));
      const rightRank = rank.get(labelOf(right));
      if (leftRank === undefined && rightRank === undefined) return 0;
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    });
    columns.splice(0, columns.length, ...sorted);
  }
  return { size: saved.size };
}
