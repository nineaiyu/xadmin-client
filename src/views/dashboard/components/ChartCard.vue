<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import {
  datasetApi,
  type AggregateResult,
  type DashboardCard,
  type ExecuteResult
} from "@/api/system/datasets";

defineOptions({ name: "DashboardChartCard" });

const props = defineProps<{ card: DashboardCard }>();

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const loading = ref(false);
const total = ref(0);
const { setOptions } = useECharts(chartRef, { theme, renderer: "svg" });

/** 容器非 0 宽高等待（路由过渡期 DOM 尺寸为 0 会报错且不自愈），照抄 TrendChart */
const waitSized = async (): Promise<boolean> => {
  for (let i = 0; i < 30; i += 1) {
    const el = chartRef.value as HTMLElement | undefined;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) return true;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
};

const PALETTE = [
  "#409eff",
  "#67c23a",
  "#e6a23c",
  "#f56c6c",
  "#909399",
  "#9a66e4"
];

const buildSeriesOptions = (result: AggregateResult): UtilsEChartsOption => {
  const names = result.series.map(item => item.name);
  const values = result.series.map(item => Number(item.value ?? 0));
  if (props.card.chart_type === "pie") {
    return {
      tooltip: { trigger: "item" },
      legend: { bottom: 0, icon: "circle" },
      series: [
        {
          name: props.card.title,
          type: "pie",
          radius: ["38%", "62%"],
          data: result.series.map((item, index) => ({
            name: item.name || "-",
            value: Number(item.value ?? 0),
            itemStyle: { color: PALETTE[index % PALETTE.length] }
          }))
        }
      ]
    };
  }
  const isLine = props.card.chart_type === "line";
  return {
    tooltip: { trigger: "axis" },
    grid: { top: "24px", left: "48px", right: "24px", bottom: "36px" },
    xAxis: { type: "category", boundaryGap: !isLine, data: names },
    yAxis: { type: "value" },
    series: [
      {
        name: props.card.title,
        type: isLine ? "line" : "bar",
        smooth: isLine,
        showSymbol: isLine,
        data: values,
        lineStyle: { width: 2, color: "#409eff" },
        itemStyle: { color: "#409eff" }
      }
    ]
  };
};

const loadData = async () => {
  const card = props.card;
  loading.value = true;
  try {
    if (card.chart_type === "number") {
      const res = await datasetApi.execute(card.dataset);
      if (res.code === 1000) {
        total.value = Number(
          (res.data as unknown as ExecuteResult)?.total ?? 0
        );
      }
      return;
    }
    const res = await datasetApi.aggregate(card.dataset, {
      group_by: card.group_by,
      metric: card.metric ?? "count",
      date_trunc:
        card.chart_type === "line" ? (card.date_trunc ?? "day") : undefined,
      value_field: card.value_field
    });
    if (res.code === 1000) {
      const result = res.data as unknown as AggregateResult;
      if (await waitSized()) setOptions(buildSeriesOptions(result));
    }
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await nextTick();
  await loadData();
});

watch(
  () => props.card,
  () => loadData(),
  { deep: true }
);

defineExpose({ loadData });
</script>

<template>
  <div v-loading="loading" class="size-full">
    <div v-if="card.chart_type === 'number'" class="flex-c size-full">
      <span class="text-3xl font-semibold">{{ total }}</span>
    </div>
    <div
      v-show="card.chart_type !== 'number'"
      ref="chartRef"
      class="size-full"
    />
  </div>
</template>
