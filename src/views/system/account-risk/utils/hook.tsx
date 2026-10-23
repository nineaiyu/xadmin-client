import { computed, type Ref } from "vue";
import { accountRiskApi } from "@/api/system/security";
import { defineListPage } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import { useRiskStats } from "./useRiskStats";
import { useRiskDialogs } from "./useRiskDialogs";
import { useRiskDetail } from "./useRiskDetail";
import { useRiskColumns } from "./useRiskColumns";
import { useRiskQuickFilter } from "./useRiskQuickFilter";
import { useRiskScan } from "./useRiskScan";
import { buildRiskPageButtons } from "./riskPageButtons";

// 展示常量与纯函数已下沉 ./display；此处再导出保持既有导入面（单测直接自 ./hook 导入）
export { metricEntriesOf, metricText } from "./display";

/**
 * 账号安全风险清单页面装配。
 *
 * 子模块：useRiskStats（统计面板）/ useRiskDialogs（处置弹窗）/
 * useRiskDetail（详情抽屉）/ useRiskColumns（列渲染）；
 * 本模块只做装配与工具栏按钮。
 */
export function useAccountRisk(selectedRows: Ref<RecordType[]>) {
  const { listColumnsFormat } = useRiskColumns();

  const page = defineListPage({
    api: accountRiskApi,
    localeName: "systemAccountRisk",
    extraAuth: ["scan", "scanStatus", "handle", "batchHandle", "stats"],
    columns: ({ columns }) => listColumnsFormat(columns)
  });
  const { api, auth, tableRef, t } = page;

  const { stats, statsGroups, statsLoading, statsError, refreshStats } =
    useRiskStats({ api, auth });
  const { handleDialog } = useRiskDialogs({
    api,
    tableRef,
    onHandled: refreshStats,
    actions: stats.value?.actions
  });
  const { openDetail } = useRiskDetail();
  refreshStats();

  /** 统计 chip 快捷筛选：按分组映射到对应搜索字段，空对象=清除筛选 */
  const { beforeSearchSubmit, onStatsChip } = useRiskQuickFilter(tableRef);

  /** 异步巡检：投递后轮询进度，终态刷新列表与统计 */
  const {
    scan,
    scanning,
    progress: scanProgress,
    stage: scanStage
  } = useRiskScan({ t, api, tableRef, refreshStats });

  /** 批量处置按钮显隐：由 selection-change 驱动的响应式选中态决定（点击时仍以
   * getSelectPks 实时取 pk，两处口径一致）；每行渲染回调查询选中数会随表格
   * 重渲染反复执行，收敛为 computed 后只在选择变化时重算 */
  const canBatchHandle = computed(() =>
    Boolean(auth.batchHandle && selectedRows.value.length)
  );

  const { tableBarButtonsProps, operationButtonsProps } = buildRiskPageButtons({
    t,
    auth,
    tableRef,
    canBatchHandle,
    scan,
    handleDialog,
    openDetail
  });

  return {
    ...page,
    stats,
    statsGroups,
    statsLoading,
    statsError,
    refreshStats,
    beforeSearchSubmit,
    onStatsChip,
    tableBarButtonsProps,
    operationButtonsProps,
    scanning,
    scanProgress,
    scanStage
  };
}
