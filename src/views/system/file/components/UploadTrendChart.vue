<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes, useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import type { FileTrendPoint } from "../utils/hook";
import { waitChartSized } from "../utils/chart";

defineOptions({ name: "FileUploadTrendChart" });

const props = defineProps<{ trend: FileTrendPoint[] }>();

const { t } = useI18n();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

const totalCount = computed(() =>
  props.trend.reduce((sum, point) => sum + (Number(point.count) || 0), 0)
);
const totalSize = computed(() =>
  props.trend.reduce((sum, point) => sum + (Number(point.size) || 0), 0)
);

const buildOptions = (): UtilsEChartsOption => ({
  tooltip: {
    trigger: "axis",
    formatter: params => {
      const first = (Array.isArray(params) ? params[0] : params) as {
        dataIndex?: number;
      };
      const row = props.trend[first?.dataIndex ?? -1];
      if (!row) return "";
      return [
        row.date,
        `${t("systemUploadFile.fileCount")}: ${row.count}`,
        `${t("systemUploadFile.size")}: ${formatBytes(row.size)}`
      ].join("<br/>");
    }
  },
  grid: { top: 20, left: 4, right: 8, bottom: 4, containLabel: true },
  xAxis: {
    type: "category",
    // 后端已按天补零，标签只取 MM-DD 避免拥挤
    data: props.trend.map(point => point.date.slice(5)),
    axisTick: { show: false }
  },
  yAxis: { type: "value", minInterval: 1 },
  series: [
    {
      type: "bar",
      name: t("systemUploadFile.fileCount"),
      barMaxWidth: 22,
      itemStyle: { borderRadius: [4, 4, 0, 0], color: "#409eff" },
      data: props.trend.map(point => Number(point.count) || 0)
    }
  ]
});

let mounted = false;
onMounted(async () => {
  await nextTick();
  if (!(await waitChartSized(() => chartRef.value as HTMLElement))) return;
  mounted = true;
  setOptions(buildOptions());
});

watch(
  [() => props.trend, () => isDark.value],
  () => {
    if (mounted) setOptions(buildOptions());
  },
  { deep: true }
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div ref="chartRef" class="h-37.5 w-full flex-1" />
    <div class="mt-1 text-xs text-gray-400">
      {{
        t("systemUploadFile.trendSummary", {
          count: totalCount,
          size: formatBytes(totalSize)
        })
      }}
    </div>
  </div>
</template>
