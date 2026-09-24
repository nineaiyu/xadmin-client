/**
 * 「我的视图」数据契约与纯函数（排序 / 条件清洗 / 归属判定）。
 *
 * 视图只存筛选条件快照（`searchFields` 剔除分页与排序），应用时仍按当前
 * 用户权限裁剪；这里集中收口，避免各组件重复判断。
 */

import { cloneDeep } from "@pureadmin/utils";

/** 视图列表行（后端 SavedListViewSerializer 契约） */
export type SavedViewRow = {
  pk: string;
  name: string;
  conditions?: Record<string, unknown>;
  remark?: string;
  is_default?: boolean;
  is_shared?: boolean;
  owner?: { pk?: number | string; username?: string; nickname?: string };
  created_time?: string;
  updated_time?: string;
};

/** 不属于筛选条件的键（分页与排序不随视图保存） */
const NON_FILTER_KEYS = ["page", "size", "ordering"];

/** 只保留有值的筛选条件（空串/空数组/空对象不入快照） */
export function cleanViewConditions(
  source?: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(source ?? {}).forEach(([key, value]) => {
    if (NON_FILTER_KEYS.includes(key)) return;
    if (value === "" || value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    result[key] = cloneDeep(value);
  });
  return result;
}

/** 当前搜索条件是否有可保存的内容 */
export function hasViewConditions(source?: Record<string, unknown>): boolean {
  return Object.keys(cleanViewConditions(source)).length > 0;
}

/** 视图归属：本人（共享视图对他人只读） */
export function isViewOwner(row: SavedViewRow, username: string): boolean {
  return !!row.owner?.username && row.owner.username === String(username ?? "");
}

/** 视图排序：默认视图 → 我的视图 → 共享视图，同组按更新时间倒序 */
export function sortViews(
  rows: SavedViewRow[],
  username: string
): SavedViewRow[] {
  const weight = (row: SavedViewRow) => {
    if (row.is_default) return 0;
    return isViewOwner(row, username) ? 1 : 2;
  };
  return [...rows].sort((a, b) => {
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return String(b.updated_time ?? "").localeCompare(
      String(a.updated_time ?? "")
    );
  });
}
