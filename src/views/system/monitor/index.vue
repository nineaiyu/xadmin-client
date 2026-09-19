<script lang="ts" setup>
import { computed, h, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { loadEcharts } from "@/plugins/echarts";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import {
  monitorApi,
  type MonitorAlertEvent,
  type MonitorMetric
} from "@/api/system/monitor";
import HealthBanner from "./components/HealthBanner.vue";
import HistoryChart from "./components/HistoryChart.vue";
import EventPanel from "./components/EventPanel.vue";
import MonitorAlertPanel from "./components/MonitorAlertPanel.vue";
import MonitorResourceCards from "./components/MonitorResourceCards.vue";
import MonitorSlowRequests from "./components/MonitorSlowRequests.vue";
import MonitorStatusPanels from "./components/MonitorStatusPanels.vue";
import MonitorToolbar from "./components/MonitorToolbar.vue";
import TaskHealthCard from "./components/TaskHealthCard.vue";
import ThresholdForm from "./components/ThresholdForm.vue";
import { useMonitor } from "./utils/hook";
import {
  DEFAULT_METRICS,
  INTERVAL_OPTIONS,
  METRIC_OPTIONS,
  buildShareQuery,
  formatComparePercent,
  formatMetricValue,
  metricLabelKey,
  metricStat,
  parseShareQuery
} from "./utils/format";

defineOptions({
  name: "SystemMonitor" // 必须定义，用于菜单自动匹配组件
});

const { t } = useI18n();
const route = useRoute();

const canUpdateThreshold = hasAuth("updateThresholds:SystemMonitor");
const canExport = hasAuth("export:SystemMonitor");

// echarts 懒加载就绪后再渲染图表（useECharts 初始化时同步读取 $echarts，见 welcome 同款处理）
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});

const {
  loading,
  autoRefresh,
  wsConnected,
  overview,
  services,
  redisInfo,
  celery,
  slow,
  taskHealth,
  history,
  historyLoading,
  thresholds,
  alerts,
  alertCounts,
  fetchAll,
  fetchHistory,
  fetchThresholds,
  saveThresholds,
  fetchAlerts,
  toggleAuto,
  start
} = useMonitor();

// ---- 趋势筛选（分享链接可复现：query 与筛选双向同步） ----
const shared = parseShareQuery((route.query ?? {}) as Record<string, unknown>);
const range = ref(shared.range);
const interval = ref(shared.interval);
const metrics = ref<MonitorMetric[]>(shared.metrics);

const RANGE_LABEL_KEYS: Record<string, string> = {
  "1h": "range1h",
  "6h": "range6h",
  "24h": "range24h",
  "7d": "range7d",
  "30d": "range30d"
};
const INTERVAL_LABEL_KEYS: Record<string, string> = {
  auto: "intervalAuto",
  "1m": "interval1m",
  "5m": "interval5m",
  "15m": "interval15m",
  "1h": "interval1h",
  "1d": "interval1d"
};

const loadHistory = () =>
  fetchHistory({
    range: range.value,
    interval: interval.value,
    metrics: metrics.value.join(",")
  });

/** 把筛选写回地址栏（分享即复制当前 URL）。
 *
 * 用 history.replaceState 直改地址栏而非 router.replace({query})：后者会驱动一次
 * 路由导航——lay-content 以 fullPath 作 <component> key，query 变化会整页销毁重建
 * （WS 断开重连、全量重拉、旧实例残留轮询），且 afterEach 的取消链路会中止刚发出的
 * 请求（图表数据恒被自己取消）。只改地址栏则组件无感，刷新/复制链接仍可按 query 复现 */
const syncQuery = () => {
  const qsStr = buildShareQuery({
    range: range.value,
    interval: interval.value,
    metrics: metrics.value
  });
  const base = location.hash.split("?")[0];
  const next = qsStr ? `${base}?${qsStr}` : base;
  if (location.hash === next) return;
  window.history.replaceState(window.history.state, "", next);
};

watch([range, interval], () => {
  loadHistory();
  syncQuery();
});
watch(
  metrics,
  () => {
    if (!metrics.value.length) metrics.value = [...DEFAULT_METRICS];
    loadHistory();
    syncQuery();
  },
  { deep: true }
);

// ---- 告警筛选与阈值设置 ----
const alertStatus = ref<"" | "firing" | "resolved">("");
watch(alertStatus, status => fetchAlerts({ status }));

const thresholdFormRef = ref<InstanceType<typeof ThresholdForm>>();
const openThresholdDialog = () => {
  if (!thresholds.value?.items?.length) return;
  thresholdFormRef.value = undefined;
  addDialog({
    title: t("systemMonitor.thresholdSettings"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(ThresholdForm, {
        ref: thresholdFormRef,
        items: thresholds.value?.items ?? []
      }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = thresholdFormRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = await saveThresholds(payload);
      if (res.code === SUCCESS_CODE) {
        message(t("systemMonitor.thresholdSaved"), { type: "success" });
        // 先关弹窗再刷新（刷新慢时不滞留弹窗）
        done();
        await fetchThresholds();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "error" });
      closeLoading();
    }
  });
};

// ---- 报表导出 / 分享 ----
const exporting = ref(false);
const exportReport = async (command: string) => {
  const [kind, type] = command.split(":");
  exporting.value = true;
  try {
    if (kind === "alerts") {
      await monitorApi.exportReport({
        kind: "alerts",
        type: type as "csv" | "xlsx",
        status: alertStatus.value
      });
    } else {
      await monitorApi.exportReport({
        kind: "history",
        type: type as "csv" | "xlsx",
        range: range.value,
        interval: interval.value,
        metrics: metrics.value.join(",")
      });
    }
    message(t("systemMonitor.exportDone"), { type: "success" });
  } catch (error) {
    message(String((error as { detail?: string })?.detail ?? error), {
      type: "error"
    });
  } finally {
    exporting.value = false;
  }
};

const shareView = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    message(t("systemMonitor.shareCopied"), { type: "success" });
  } catch {
    message(String(window.location.href), { type: "info", duration: 5000 });
  }
};

const historyChartRef = ref<InstanceType<typeof HistoryChart>>();
const exportChartImage = () => {
  const ok = historyChartRef.value?.exportImage();
  if (!ok) message(t("systemMonitor.trendEmpty"), { type: "warning" });
};

// ---- 实时卡片 ----
const currentMetrics = computed(
  () => overview.value.live ?? overview.value.latest
);

const resourceCards = computed(() => {
  const current = currentMetrics.value;
  return [
    {
      key: "cpu",
      label: t("systemMonitor.cpu"),
      value: current?.cpu_percent ?? 0,
      suffix: "%",
      ring: true
    },
    {
      key: "memory",
      label: t("systemMonitor.memory"),
      value: current?.memory_used ?? 0,
      suffix: "%",
      ring: true
    },
    {
      key: "disk",
      label: t("systemMonitor.disk"),
      value: current?.disk_used ?? 0,
      suffix: "%",
      ring: true
    },
    {
      // cpu_load 是负载均值（如 0.14），不是百分比：进度环会被 Math.round 归零
      // 成空环配原始数字，改用纯数字展示
      key: "load",
      label: t("systemMonitor.load"),
      value: current?.cpu_load ?? 0,
      suffix: "",
      ring: false
    }
  ];
});

const netRates = computed(() => ({
  sent: overview.value.live?.net_sent_rate,
  recv: overview.value.live?.net_recv_rate,
  sentTotal: overview.value.live?.net_sent_mb,
  recvTotal: overview.value.live?.net_recv_mb
}));

const runtimeItems = computed(() => {
  const live = overview.value.live;
  if (!live) return [];
  return [
    {
      key: "cores",
      label: t("systemMonitor.cores"),
      value: String(live.cpu_count ?? "—")
    },
    {
      key: "processes",
      label: t("systemMonitor.processes"),
      value: String(live.process_count ?? "—")
    },
    {
      key: "swap",
      label: t("systemMonitor.swap"),
      value: `${live.swap_percent ?? 0}%`
    }
  ];
});

const serviceItems = computed(() => {
  const items = services.value;
  return [
    {
      key: "db",
      label: t("systemMonitor.db"),
      ok: items?.db.status ?? false,
      cost: items?.db.cost
    },
    {
      key: "redis",
      label: t("systemMonitor.redis"),
      ok: items?.redis.status ?? false,
      cost: items?.redis.cost
    },
    {
      key: "celery",
      label: t("systemMonitor.celery"),
      ok: items?.celery.status ?? false,
      cost: items?.celery.cost
    }
  ];
});

const redis = computed(() => redisInfo.value.redis ?? {});
const queues = computed(
  () =>
    Object.entries(redisInfo.value.queues ?? {}).filter(
      entry => typeof entry[1] === "number"
    ) as [string, number][]
);
const slowRows = computed(() => slow.value.results ?? []);
const alertRows = computed(() => alerts.value as MonitorAlertEvent[]);

/** 趋势摘要（平均 / 峰值 / 环比），逐指标 chips 展示 */
const metricSummaries = computed(() =>
  metrics.value.map(metric => {
    const stat = metricStat(history.value, metric);
    const compare = history.value?.compare?.[metric];
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

const eventPanelRef = ref<InstanceType<typeof EventPanel>>();

const refreshAll = async () => {
  await fetchAll(true);
  loadHistory();
  eventPanelRef.value?.refresh();
};

start();
loadHistory();

onMounted(() => {
  // 首帧 WS 推送可能早于初始 HTTP 拉取，start() 已完成；此处只兜底 URL 无 query 时不写回
  if (!route.query.range) syncQuery();
});
</script>

<template>
  <div class="main">
    <health-banner :health="overview.health" />

    <MonitorToolbar
      v-model:auto-refresh="autoRefresh"
      :ws-connected="wsConnected"
      :loading="loading"
      :exporting="exporting"
      :can-export="canExport"
      @toggle-auto="toggleAuto"
      @refresh="refreshAll"
      @share="shareView"
      @export-report="exportReport"
    />

    <MonitorResourceCards :cards="resourceCards" :net-rates="netRates" />

    <el-card v-loading="historyLoading" shadow="never" class="mb-4">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <span>{{ t("systemMonitor.historyTrend") }}</span>
          <el-radio-group v-model="range" size="small">
            <el-radio-button
              v-for="(labelKey, key) in RANGE_LABEL_KEYS"
              :key="key"
              :value="key"
            >
              {{ t(`systemMonitor.${labelKey}`) }}
            </el-radio-button>
          </el-radio-group>
          <el-select
            v-model="interval"
            size="small"
            class="w-28!"
            :placeholder="t('systemMonitor.intervalLabel')"
          >
            <el-option
              v-for="option in INTERVAL_OPTIONS"
              :key="option"
              :value="option"
              :label="t(`systemMonitor.${INTERVAL_LABEL_KEYS[option]}`)"
            />
          </el-select>
          <el-select
            v-model="metrics"
            multiple
            collapse-tags
            size="small"
            class="w-64!"
            :placeholder="t('systemMonitor.metricsLabel')"
          >
            <el-option
              v-for="metric in METRIC_OPTIONS"
              :key="metric"
              :value="metric"
              :label="metricLabel(metric)"
            />
          </el-select>
          <div class="flex-1" />
          <el-button
            link
            type="primary"
            data-testid="monitor-export-image"
            @click="exportChartImage"
          >
            {{ t("systemMonitor.exportImage") }}
          </el-button>
        </div>
      </template>

      <div class="mb-3 flex flex-wrap gap-4">
        <div
          v-for="item in metricSummaries"
          :key="item.metric"
          class="flex items-center gap-2 rounded bg-gray-50 px-3 py-1.5 text-sm dark:bg-(--el-fill-color-light)"
        >
          <span class="text-gray-500">{{ item.label }}</span>
          <span class="font-medium">{{ item.avg }}</span>
          <el-tag
            v-if="item.percent"
            :type="item.rising ? 'warning' : 'success'"
            size="small"
            effect="plain"
          >
            {{ item.percent }}
          </el-tag>
          <span class="text-xs text-gray-400">
            {{
              t("systemMonitor.summaryRange", { min: item.min, max: item.max })
            }}
          </span>
        </div>
      </div>

      <HistoryChart
        v-if="echartsReady && history && history.points.length"
        ref="historyChartRef"
        :history="history"
        :metrics="metrics"
      />
      <el-empty
        v-else-if="echartsReady"
        :description="t('systemMonitor.trendEmpty')"
        :image-size="60"
      />
    </el-card>

    <MonitorStatusPanels
      :service-items="serviceItems"
      :runtime-items="runtimeItems"
      :redis="redis"
      :celery="celery"
      :queues="queues"
      :latest="overview.latest"
    />

    <MonitorAlertPanel
      v-model:status="alertStatus"
      :rows="alertRows"
      :counts="alertCounts"
      :thresholds="thresholds"
      :can-update-threshold="canUpdateThreshold"
      @open-threshold="openThresholdDialog"
    />

    <event-panel ref="eventPanelRef" class="mb-4" />

    <task-health-card :health="taskHealth" />

    <MonitorSlowRequests :rows="slowRows" :threshold="slow.threshold" />
  </div>
</template>
