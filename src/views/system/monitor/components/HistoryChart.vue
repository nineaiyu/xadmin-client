<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import type { MonitorHistory, MonitorMetric } from "@/api/system/monitor";
import { epColor } from "@/utils/chartTheme";
import {
  METRIC_META,
  buildSeries,
  formatHistoryTime,
  metricLabelKey,
  rangeSpanSeconds
} from "../utils/format";

defineOptions({ name: "MonitorHistoryChart" });

const props = defineProps<{
  history: MonitorHistory | null;
  metrics: MonitorMetric[];
}>();

const { t } = useI18n();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions, getInstance } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 百分比类与数值类（负载/网络速率）分轴，避免量纲互压 */
const hasPercent = computed(() =>
  props.metrics.some(metric => METRIC_META[metric]?.axis === "percent")
);
const hasValue = computed(() =>
  props.metrics.some(metric => METRIC_META[metric]?.axis === "value")
);

const seriesName = (metric: MonitorMetric) => {
  const unit = METRIC_META[metric]?.unit ?? "";
  const label = t(metricLabelKey(metric));
  return unit ? `${label} (${unit})` : label;
};

const seriesColor = (metric: MonitorMetric) => {
  const color = METRIC_META[metric]?.color;
  return color ? epColor(color) : "#9a66e4";
};

const axisIndex = (metric: MonitorMetric) => {
  if (METRIC_META[metric]?.axis === "percent") return 0;
  return hasPercent.value ? 1 : 0;
};

const buildOptions = (): UtilsEChartsOption => {
  const history = props.history;
  const span = rangeSpanSeconds(history?.range?.range_key ?? "24h");
  const labels = (history?.points ?? []).map(point =>
    formatHistoryTime(point.time, span)
  );
  const yAxis: Record<string, unknown>[] = [];
  if (hasPercent.value) {
    yAxis.push({
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%" }
    });
  }
  if (hasValue.value) {
    yAxis.push({
      type: "value",
      splitLine: { show: !hasPercent.value }
    });
  }
  return {
    tooltip: { trigger: "axis" },
    legend: {
      top: 0,
      right: 0,
      icon: "circle",
      data: props.metrics.map(seriesName)
    },
    grid: {
      top: "36px",
      left: "52px",
      right: hasValue.value ? "64px" : "24px",
      bottom: "48px"
    },
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
      { type: "slider", height: 16, bottom: 8 }
    ],
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: labels
    },
    yAxis,
    series: props.metrics.map(metric => ({
      name: seriesName(metric),
      type: "line",
      smooth: true,
      showSymbol: false,
      yAxisIndex: axisIndex(metric),
      connectNulls: false,
      data: buildSeries(history, metric),
      lineStyle: { width: 2, color: seriesColor(metric) },
      itemStyle: { color: seriesColor(metric) },
      areaStyle: props.metrics.length === 1 ? { opacity: 0.1 } : undefined
    }))
  };
};

let mounted = false;

/** 等容器有非 0 宽高再 init：路由切换过渡期间挂载时 DOM 尺寸为 0，
 * echarts init 会报 "Can't get DOM width or height" 且不再自愈 */
const waitSized = async (): Promise<boolean> => {
  for (let i = 0; i < 30; i += 1) {
    const el = chartRef.value as HTMLElement | undefined;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) return true;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
};

onMounted(async () => {
  await nextTick();
  if (!(await waitSized())) return;
  mounted = true;
  setOptions(buildOptions());
});

watch(
  [() => props.history, () => props.metrics],
  async () => {
    if (!mounted) return;
    await nextTick();
    setOptions(buildOptions());
  },
  { deep: true }
);

/** 导出当前趋势为 PNG（分享/汇报用，与报表导出互补） */
const exportImage = () => {
  const instance = getInstance();
  if (!instance) return false;
  const url = instance.getDataURL({
    type: "png",
    pixelRatio: 2,
    backgroundColor: isDark.value ? "#1d1e1f" : "#ffffff"
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = `monitor-trend-${Date.now()}.png`;
  link.click();
  return true;
};

defineExpose({ exportImage });
</script>

<template>
  <div
    ref="chartRef"
    class="history-chart w-full"
    style="height: 260px"
    data-testid="monitor-history-chart"
  />
</template>
