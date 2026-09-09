<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import type { MonitorOverview } from "@/api/system/monitor";

defineOptions({ name: "MonitorTrendChart" });

const props = defineProps<{ trend: MonitorOverview["trend"] }>();

const { t } = useI18n();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 仅绘制百分比指标（cpu_load 非百分比，量纲不同不入图） */
const SERIES = [
  { key: "cpu_percent", nameKey: "systemMonitor.cpu", color: "#409eff" },
  { key: "memory_used", nameKey: "systemMonitor.memory", color: "#67c23a" },
  { key: "disk_used", nameKey: "systemMonitor.disk", color: "#e6a23c" }
] as const;

const buildOptions = (): UtilsEChartsOption => ({
  tooltip: { trigger: "axis" },
  legend: {
    top: 0,
    right: 0,
    icon: "circle",
    data: SERIES.map(series => t(series.nameKey))
  },
  grid: { top: "36px", left: "48px", right: "24px", bottom: "48px" },
  // 60 个采样点可能超出可视宽度，内置缩放 + 底部滑条回看历史区间
  dataZoom: [
    { type: "inside", start: 0, end: 100 },
    { type: "slider", height: 16, bottom: 8 }
  ],
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: props.trend.map(point => String(point.created_time).slice(11, 19))
  },
  yAxis: {
    type: "value",
    max: 100,
    axisLabel: { formatter: "{value}%" }
  },
  series: SERIES.map(series => ({
    name: t(series.nameKey),
    type: "line",
    smooth: true,
    showSymbol: false,
    data: props.trend.map(point => Number(point[series.key] ?? 0)),
    lineStyle: { width: 2, color: series.color },
    itemStyle: { color: series.color },
    areaStyle: { opacity: 0.08 }
  }))
});

let mounted = false;

/** 等容器有非 0 宽高再 init：路由切换过渡动画期间挂载时 DOM 尺寸为 0，
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
  () => props.trend,
  () => {
    if (mounted) setOptions(buildOptions());
  },
  { deep: true }
);
</script>

<template>
  <div ref="chartRef" class="trend-chart w-full" style="height: 220px" />
</template>
