import { ref, type Ref } from "vue";

/** 统计 chip → 列表搜索条件的快捷筛选（自 hook 抽出，控制 hook 行数） */
export function useRiskQuickFilter(tableRef: Ref) {
  const quickFilter = ref<Record<string, string>>({});
  const beforeSearchSubmit = (params: Record<string, unknown>) => ({
    ...params,
    ...quickFilter.value
  });
  const onStatsChip = (payload: { group: string; chip: { key: string } }) => {
    const next: Record<string, string> = {};
    if (payload.group === "level") next.level = payload.chip.key;
    else if (payload.group === "status") next.status = payload.chip.key;
    else if (payload.group === "type") next.risk_type = payload.chip.key;
    else if (payload.group === "overview" && payload.chip.key === "pending")
      next.status = "pending";
    quickFilter.value = next;
    tableRef.value?.handleGetData?.();
  };
  return { beforeSearchSubmit, onStatsChip };
}
