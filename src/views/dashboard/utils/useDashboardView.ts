import { ref } from "vue";
import type { Ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { copyText } from "@/utils/clipboard";
import { message } from "@/utils/message";
import {
  buildDashboardShareUrl,
  fetchDashboardDatasets,
  fetchDashboardList,
  resolveInitialDashboard,
  syncDashboardQuery as syncQuery
} from "./dashboardViewState";

type Translate = (key: string) => string;
type SwitchGuard = () => boolean | void | Promise<boolean | void>;

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
  const loadFailed = ref(false);
  const loadError = ref("");
  const datasets = ref<DatasetItem[]>([]);
  /** 卡片刷新信号：自增经 refreshToken prop 下发，ChartCard 原位重拉（不销毁 ECharts 实例） */
  const refreshKey = ref(0);
  let switchGuard: SwitchGuard | null = null;
  const refreshCards = () => {
    refreshKey.value += 1;
  };

  /** 切换仪表盘前的收口钩子（编辑态注册：草稿有改动时先确认，放弃草稿才放行） */
  const setSwitchGuard = (guard: SwitchGuard) => {
    switchGuard = guard;
  };

  const loadDashboards = async () => {
    loading.value = true;
    loadFailed.value = false;
    loadError.value = "";
    try {
      // fetchAllRows：下拉与 ?pk= 分享定位必须覆盖全量仪表盘——只取首页 20 条
      // 会让超出分页的仪表盘在下拉里缺失、分享定位静默回落（与 loadDatasets 同口径）
      dashboards.value = await fetchDashboardList();
      if (!current.value && dashboards.value.length > 0) {
        // 分享链接定位：?pk=<仪表盘主键> 命中则直接打开对应仪表盘
        const sharedPk =
          typeof route.query.pk === "string" ? route.query.pk : "";
        current.value = resolveInitialDashboard(dashboards.value, sharedPk);
        // 首次落地即写回地址栏，分享时无需依赖异步 replace 完成
        syncQuery(router, route, current.value?.pk);
      }
    } catch {
      // 清单失败不能伪装成「暂无仪表盘」：给错误态与重试入口
      loadFailed.value = true;
      loadError.value = t("dashboard.loadFailed");
    } finally {
      loading.value = false;
    }
  };

  const loadDatasets = async () => {
    // 数据集下拉失败不阻塞主链路：显式提示（此前未捕获，失败无感知）
    const rows = await fetchDashboardDatasets();
    if (!rows) {
      message(t("dashboard.datasetsLoadFailed"), { type: "warning" });
      return;
    }
    datasets.value = rows;
  };

  /** 选中仪表盘并把 pk 写回地址栏（分享即复制当前 URL） */
  const selectDashboard = async (pk: string) => {
    if ((await switchGuard?.()) === false) return;
    current.value = dashboards.value.find(item => item.pk === pk) ?? null;
    syncQuery(router, route, current.value?.pk);
  };

  /** 复制当前仪表盘视图链接（同角色内有权限者打开即定位到该仪表盘） */
  const shareDashboard = async () => {
    if (!current.value) return;
    // 用 router.resolve 生成地址，自动适配 hash / h5 两种路由模式
    const shareUrl = buildDashboardShareUrl(
      router,
      route,
      current.value.pk,
      window.location.origin
    );
    syncQuery(router, route, current.value.pk);
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
    loadFailed,
    loadError,
    refreshCards,
    refreshKey,
    selectDashboard,
    setSwitchGuard,
    shareDashboard,
    syncDashboardQuery: () => syncQuery(router, route, current.value?.pk)
  };
}
