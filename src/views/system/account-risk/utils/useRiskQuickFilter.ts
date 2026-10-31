import { ref, type Ref } from "vue";

/** 统计 chip → 列表搜索条件的快捷筛选（自 hook 抽出，控制 hook 行数） */
export function useRiskQuickFilter(tableRef: Ref) {
  const quickFilter = ref<Record<string, string>>({});
  const beforeSearchSubmit = (params: Record<string, unknown>) => ({
    ...params,
    ...quickFilter.value
  });
  const filterOf = (payload: { group: string; chip: { key: string } }) => {
    const next: Record<string, string> = {};
    if (payload.group === "level") next.level = payload.chip.key;
    else if (payload.group === "status") next.status = payload.chip.key;
    else if (payload.group === "type") next.risk_type = payload.chip.key;
    else if (payload.group === "overview" && payload.chip.key === "pending")
      next.status = "pending";
    return next;
  };
  const onStatsChip = (payload: { group: string; chip: { key: string } }) => {
    const next = filterOf(payload);
    // 再次点击同一 chip = 取消该快捷筛选（否则条件隐形且永久残留）
    const same =
      Object.keys(next).length === Object.keys(quickFilter.value).length &&
      Object.entries(next).every(
        ([key, value]) => quickFilter.value[key] === value
      );
    quickFilter.value = same ? {} : next;
    tableRef.value?.handleGetData?.();
  };
  const clearQuickFilter = () => {
    if (!Object.keys(quickFilter.value).length) return;
    quickFilter.value = {};
    tableRef.value?.handleGetData?.();
  };
  return { beforeSearchSubmit, onStatsChip, quickFilter, clearQuickFilter };
}
