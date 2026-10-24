import { computed, type Ref } from "vue";
import type { MonitorMetric } from "@/api/system/monitor";
import type { useMonitor } from "./hook";
import {
  formatComparePercent,
  formatMetricValue,
  metricLabelKey,
  metricStat
} from "./format";
import {
  buildResourceCards,
  buildRuntimeItems,
  buildServiceItems
} from "./monitorCards";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type MonitorApi = ReturnType<typeof useMonitor>;

/**
 * 监控页的视图模型派生（自 index.vue 抽出，行数门禁）。
 *
 * 把 useMonitor 的原始响应映射成各卡片 / 面板的展示形状：资源四卡（缺失即
 * 未知，不用 0 兜底——否则「接口失败」会被画成「CPU 0%」的确定结论）、
 * 网络速率、运行时与三大服务状态、Redis/队列、慢查询行、告警行、趋势摘要
 * （平均 / 峰值 / 环比 chips）。卡片 / 状态项的静态形状构造在
 * `monitorCards.ts`（纯函数），本文件只保留响应 → 形状的 computed 接线。
 */
export function useMonitorView(deps: {
  t: TFunction;
  monitor: MonitorApi;
  metrics: Ref<MonitorMetric[]>;
}) {
  const { t, monitor } = deps;

  /** 实时卡片：优先 WS 实时帧，回落最近一次采样 */
  const currentMetrics = computed(
    () => monitor.overview.value.live ?? monitor.overview.value.latest
  );

  const resourceCards = computed(() =>
    buildResourceCards(t, currentMetrics.value)
  );

  const netRates = computed(() => ({
    sent: monitor.overview.value.live?.net_sent_rate,
    recv: monitor.overview.value.live?.net_recv_rate,
    sentTotal: monitor.overview.value.live?.net_sent_mb,
    recvTotal: monitor.overview.value.live?.net_recv_mb
  }));

  const runtimeItems = computed(() =>
    buildRuntimeItems(t, monitor.overview.value.live)
  );

  const serviceItems = computed(() =>
    buildServiceItems(t, monitor.services.value)
  );

  const redis = computed(() => monitor.redisInfo.value.redis ?? {});
  const queues = computed(
    () =>
      Object.entries(monitor.redisInfo.value.queues ?? {}).filter(
        entry => typeof entry[1] === "number"
      ) as [string, number][]
  );
  const slowRows = computed(() => monitor.slow.value.results ?? []);
  const alertRows = computed(() => monitor.alerts.value);

  /** 趋势摘要（平均 / 峰值 / 环比），逐指标 chips 展示 */
  const metricSummaries = computed(() =>
    deps.metrics.value.map(metric => {
      const stat = metricStat(monitor.history.value, metric);
      const compare = monitor.history.value?.compare?.[metric];
      return {
        metric,
        label: t(metricLabelKey(metric)),
        avg: formatMetricValue(metric, stat.avg),
        max: formatMetricValue(metric, stat.max),
        min: formatMetricValue(metric, stat.min),
        percent: formatComparePercent(compare?.percent),
        rising: (compare?.percent ?? 0) > 0
      };
    })
  );

  const metricLabel = (metric: MonitorMetric) => t(metricLabelKey(metric));

  return {
    currentMetrics,
    resourceCards,
    netRates,
    runtimeItems,
    serviceItems,
    redis,
    queues,
    slowRows,
    alertRows,
    metricSummaries,
    metricLabel
  };
}
