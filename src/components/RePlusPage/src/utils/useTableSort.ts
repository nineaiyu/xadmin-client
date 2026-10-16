import { nextTick, watch, type Ref } from "vue";

type SearchFieldValue = {
  ordering?: unknown;
  page?: number;
  [key: string]: unknown;
};

/**
 * 解析 ordering 字符串为 el-table 排序状态（纯函数，单测出口）。
 * 复合排序（如 "sort,created_time"）只回显首个字段：表头标记无法表达多列排序。
 */
export const parseOrdering = (ordering: unknown) => {
  if (typeof ordering !== "string" || !ordering) return null;
  const trimmed = ordering.split(",")[0].trim();
  if (!trimmed) return null;
  const descending = trimmed.startsWith("-");
  const prop = descending ? trimmed.slice(1) : trimmed;
  if (!prop) return null;
  return {
    prop,
    order: descending ? ("descending" as const) : ("ascending" as const)
  };
};

/**
 * 表头排序：与搜索区 ordering 下拉同源（`searchFields.ordering` 是唯一排序状态载体）。
 *
 * - 点击表头（el-table `sort-change`，仅元数据下发 `sortable` 的列会触发）
 *   → 写入 ordering（升序 `field` / 降序 `-field`）→ 回到第一页刷新列表；
 * - 取消排序（`order` 为 null）回落页面默认 ordering（`defaultValue.ordering`）；
 * - 外部改 ordering（搜索区下拉 / 重置 / 我的视图套用）→ 同步回显表头排序标记；
 * - 未声明 sortable 的页面零变化：无排序交互，watch 仅在 ordering 变化时被动同步。
 */
export function useTableSort({
  searchFields,
  defaultValue,
  tableRef,
  handleGetData
}: {
  searchFields: Ref<SearchFieldValue>;
  defaultValue: Ref<Record<string, unknown>>;
  tableRef: Ref;
  handleGetData: () => void;
}) {
  /** 程序性回显（table.sort / clearSort）会再次派发 sort-change，需在下一次事件循环内忽略 */
  let syncing = false;

  /** 表头排序变化：写回 ordering 并以第一页重新请求 */
  const handleSortChange = ({
    prop,
    order
  }: {
    prop?: string | null;
    order?: string | null;
  }) => {
    if (syncing || !prop) return;
    const fallback = defaultValue.value?.ordering;
    searchFields.value.ordering = order
      ? order === "ascending"
        ? prop
        : `-${prop}`
      : typeof fallback === "string"
        ? fallback
        : "";
    searchFields.value.page = 1;
    handleGetData();
  };

  /**
   * 初始化阶段（元数据装配写入默认 ordering）不回显：页面加载零视觉变化，
   * 视觉基线 / 既有页面行为不受影响；此后的任何 ordering 变化都同步表头标记。
   */
  let initialized = false;

  watch(
    () => searchFields.value?.ordering,
    ordering => {
      if (!initialized) {
        initialized = true;
        return;
      }
      // 表格实例在挂载后才有；未启用表格的页面直接跳过
      const table = tableRef.value?.getTableRef?.();
      if (!table) return;
      const parsed = parseOrdering(ordering);
      syncing = true;
      try {
        if (parsed) {
          table.sort?.(parsed.prop, parsed.order);
        } else {
          table.clearSort?.();
        }
      } finally {
        // el-table 的 sort() 同步提交状态，sort-change 事件由其内部 watcher 派发，
        // 落到下一 tick；此处等一帧再解除忽略
        nextTick(() => {
          syncing = false;
        });
      }
    }
  );

  return { handleSortChange };
}
