import { computed, type Ref } from "vue";
import { INJECTED_COLUMN_KEYS } from "./constants";
import type { PageColumn } from "./types";

/** 是否为框架注入列（选择列 / 操作列）——它们无条件存在，不来自后端元数据 */
function isInjectedColumn(column?: PageColumn) {
  return INJECTED_COLUMN_KEYS.includes(
    (column?._column?.key ?? "") as (typeof INJECTED_COLUMN_KEYS)[number]
  );
}

/**
 * 搜索区元数据是否到达（搜索卡片高度占位 / 元数据缺失警示共用）。
 *
 * 表格列元数据到达时必须排除框架注入列：不能看 listColumns.length（恒 ≥1），
 * 也不能看 tableBarData.dynamicColumns（初值就是同一数组），否则判定恒为真。
 */
export function useSearchMetaReady(
  searchColumns: Ref<PageColumn[]>,
  listColumns: Ref<PageColumn[]>
) {
  return computed(
    () =>
      searchColumns.value.length > 0 ||
      listColumns.value.some(column => !isInjectedColumn(column))
  );
}
