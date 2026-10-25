import { ref } from "vue";
import type { Ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import { copyText } from "@/utils/clipboard";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { message } from "@/utils/message";

type Translate = (key: string) => string;

/** 仪表盘展示态：清单加载 / 当前选中 / 分享定位 / 数据集目录 / 卡片刷新信号（切盘经 setSwitchGuard 通知编辑态收口） */
export function useDashboardView(options: {
  t: Translate;
  route: RouteLocationNormalizedLoaded;
  router: Router;
}) {
  const { t, route, router } = options;
  const dashboards = ref<DashboardItem[]>([]);
  const current = ref<DashboardItem | null>(null);
  const loading = ref(false);
  const datasets = ref<DatasetItem[]>([]);
  /** 卡片刷新信号：自增经 refreshToken prop 下发，ChartCard 原位重拉（不销毁 ECharts 实例） */
  const refreshKey = ref(0);
  let switchGuard: (() => void) | null = null;

  const refreshCards = () => {
    refreshKey.value += 1;
  };

  /** 切换仪表盘前的收口钩子（编辑态注册：放弃草稿并退出编辑） */
  const setSwitchGuard = (guard: () => void) => {
    switchGuard = guard;
  };

  const syncDashboardQuery = () => {
    if (!current.value) return;
    router.replace({ query: { ...route.query, pk: current.value.pk } });
  };

  const loadDashboards = async () => {
    loading.value = true;
    try {
      // fetchAllRows：下拉与 ?pk= 分享定位必须覆盖全量仪表盘——只取首页 20 条
      // 会让超出分页的仪表盘在下拉里缺失、分享定位静默回落（与 loadDatasets 同口径）
      const res = await fetchAllRows(dashboardApi.list);
      dashboards.value = listRows<DashboardItem>(res as never);
      if (!current.value && dashboards.value.length > 0) {
        // 分享链接定位：?pk=<仪表盘主键> 命中则直接打开对应仪表盘
        const sharedPk =
          typeof route.query.pk === "string" ? route.query.pk : "";
        current.value =
          dashboards.value.find(item => item.pk === sharedPk) ??
          dashboards.value[0];
        // 首次落地即写回地址栏，分享时无需依赖异步 replace 完成
        syncDashboardQuery();
      }
    } finally {
      loading.value = false;
    }
  };

  const loadDatasets = async () => {
    // 数据集下拉失败不阻塞主链路：显式提示（此前未捕获，失败无感知）
    const res = await fetchAllRows(datasetApi.list).catch(() => null);
    if (!res) {
      message(t("dashboard.datasetsLoadFailed"), { type: "warning" });
      return;
    }
    datasets.value = listRows<DatasetItem>(res as never);
  };

  /** 选中仪表盘并把 pk 写回地址栏（分享即复制当前 URL） */
  const selectDashboard = (pk: string) => {
    switchGuard?.();
    current.value = dashboards.value.find(item => item.pk === pk) ?? null;
    syncDashboardQuery();
  };

  /** 复制当前仪表盘视图链接（同角色内有权限者打开即定位到该仪表盘） */
  const shareDashboard = async () => {
    if (!current.value) return;
    // 直接构造带 pk 的完整 URL：router.replace 是异步的，首次分享不能依赖地址栏已更新
    const [base] = window.location.href.split("#");
    const query = new URLSearchParams({
      ...route.query,
      pk: current.value.pk
    } as Record<string, string>);
    const shareUrl = `${base}#${route.path}?${query.toString()}`;
    syncDashboardQuery();
    await copyText(shareUrl, { failureFallbackText: shareUrl });
  };

  const datasetName = (pk: string) =>
    datasets.value.find(item => item.pk === pk)?.name ?? pk;

  return {
    current: current as Ref<DashboardItem | null>,
    dashboards: dashboards as Ref<DashboardItem[]>,
    datasetName,
    datasets,
    loadDashboards,
    loadDatasets,
    loading,
    refreshCards,
    refreshKey,
    selectDashboard,
    setSwitchGuard,
    shareDashboard,
    syncDashboardQuery
  };
}
