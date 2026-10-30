<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import RePage from "@/components/RePage";
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { loadEcharts } from "@/plugins/echarts";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { copyText } from "@/utils/clipboard";
import { hasAuth } from "@/router/utils";
import { monitorApi, type MonitorMetric } from "@/api/system/monitor";
import HealthBanner from "./components/HealthBanner.vue";
import HistoryChart from "./components/HistoryChart.vue";
import EventPanel from "./components/EventPanel.vue";
import MonitorAlertPanel from "./components/MonitorAlertPanel.vue";
import MonitorResourceCards from "./components/MonitorResourceCards.vue";
import MonitorSlowRequests from "./components/MonitorSlowRequests.vue";
import MonitorStatusPanels from "./components/MonitorStatusPanels.vue";
import MonitorToolbar from "./components/MonitorToolbar.vue";
import TaskHealthCard from "./components/TaskHealthCard.vue";
import { useMonitor } from "./utils/hook";
import { useMonitorView } from "./utils/useMonitorView";
import { useThresholdDialog } from "./utils/useThresholdDialog";
import {
  DEFAULT_METRICS,
  INTERVAL_LABEL_KEYS,
  INTERVAL_OPTIONS,
  METRIC_OPTIONS,
  RANGE_LABEL_KEYS,
  buildShareQuery,
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

const monitorState = useMonitor();
const {
  loading,
  autoRefresh,
  wsConnected,
  overview,
  celery,
  slow,
  taskHealth,
  history,
  historyLoading,
  thresholds,
  alertCounts,
  sectionErrors,
  fetchAll,
  fetchHistory,
  fetchThresholds,
  saveThresholds,
  fetchAlerts,
  toggleAuto,
  start
} = monitorState;

// ---- 趋势筛选（分享链接可复现：query 与筛选双向同步） ----
const shared = parseShareQuery((route.query ?? {}) as Record<string, unknown>);
const range = ref(shared.range);
const interval = ref(shared.interval);
const metrics = ref<MonitorMetric[]>(shared.metrics);

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

const { openThresholdDialog } = useThresholdDialog({
  t,
  thresholds,
  saveThresholds,
  fetchThresholds,
  fetchAlerts,
  alertStatus
});

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
    message(normalizeError(error).detail, {
      type: "error"
    });
  } finally {
    exporting.value = false;
  }
};

const shareView = async () => {
  // 剪贴板不可用（非 https/权限受限）时降级展示链接供手动复制
  await copyText(window.location.href, {
    failureFallbackText: String(window.location.href)
  });
};

const historyChartRef = ref<InstanceType<typeof HistoryChart>>();
const exportChartImage = () => {
  const ok = historyChartRef.value?.exportImage();
  if (!ok) message(t("systemMonitor.trendEmpty"), { type: "warning" });
};

// ---- 实时卡片（视图模型派生见 utils/useMonitorView.ts，行数门禁抽出） ----
const {
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
} = useMonitorView({ t, monitor: monitorState, metrics });

const eventPanelRef = ref<InstanceType<typeof EventPanel>>();

const refreshAll = async () => {
  await fetchAll(true);
  // fetchAll 内的告警请求不带筛选，刷新后按当前告警状态再收口一次
  await fetchAlerts({ status: alertStatus.value || undefined });
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
  <RePage>
    <health-banner
      :health="overview.health"
      :unavailable="Boolean(sectionErrors.overview)"
    />

    <div
      v-if="sectionErrors.overview || sectionErrors.services"
      class="mb-4 flex items-center gap-3"
      data-testid="monitor-unavailable"
    >
      <el-alert
        class="flex-1"
        type="warning"
        :closable="false"
        show-icon
        :title="t('systemMonitor.dataUnavailable')"
        :description="
          sectionErrors.overview || sectionErrors.services || undefined
        "
      />
      <el-button size="small" @click="refreshAll">
        {{ t("systemMonitor.refresh") }}
      </el-button>
    </div>

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
          class="flex items-center gap-2 rounded bg-(--el-fill-color-light) px-3 py-1.5 text-sm"
        >
          <span class="text-(--el-text-color-regular)">{{ item.label }}</span>
          <span class="font-medium">{{ item.avg }}</span>
          <el-tag
            v-if="item.percent"
            :type="item.rising ? 'warning' : 'success'"
            size="small"
            effect="plain"
          >
            {{ item.percent }}
          </el-tag>
          <span class="text-xs text-(--el-text-color-secondary)">
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
      <ReEmpty
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
  </RePage>
</template>
