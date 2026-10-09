<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AiUsageDimensionStat, AiUsageSummary } from "@/api/ai/ai";
import { loadEcharts } from "@/plugins/echarts";

defineOptions({
  name: "AiRunDashboard"
});

const props = defineProps<{
  /** 用量账本汇总（数据源同用量端点；null = 尚未加载） */
  usage: AiUsageSummary | null;
  /** 加载态由页面侧传入（与用量卡片共用同一次请求） */
  loading?: boolean;
}>();

const { t } = useI18n();

// echarts 与图表组件都按需懒加载（与 plugins/echarts 的异步形态一致）
const echartsReady = ref(false);
const ChartLine = defineAsyncComponent(
  () => import("@/views/welcome/components/ChartLine.vue")
);

onMounted(async () => {
  // echarts 懒加载就绪后再渲染图表（useECharts 初始化时同步读取 $echarts）
  await loadEcharts();
  echartsReady.value = true;
});

const hasUsageData = computed(() => (props.usage?.total_calls ?? 0) > 0);
const usageTrend = computed(() =>
  (props.usage?.by_day ?? []).map(row => row.calls)
);

// 延迟展示：无样本 / 样本不足统一降级为占位符，不把 null 渲染成 0
const latencyText = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value} ms`;

const dashboardCards = computed(() => {
  const data = props.usage;
  return [
    {
      label: t("aiConfig.dashboardRate"),
      value: data ? `${data.success_rate ?? 0}%` : "—",
      hint: ""
    },
    {
      label: t("aiConfig.dashboardAvg"),
      value: latencyText(data?.avg_latency_ms),
      hint: ""
    },
    {
      label: t("aiConfig.dashboardP95"),
      value: latencyText(data?.p95_latency_ms),
      // 抽样不足：P95 不给出（避免小样本分位数误导），显式提示
      hint:
        data && data.p95_latency_ms === null
          ? t("aiConfig.dashboardP95LowSample")
          : ""
    },
    {
      label: t("aiConfig.dashboardSamples"),
      value: String(data?.latency_samples ?? 0),
      hint: ""
    }
  ];
});

const dimensionPercent = (
  calls: number,
  rows: AiUsageDimensionStat[] | undefined
) => {
  const max = Math.max(1, ...(rows ?? []).map(row => row.calls));
  return Math.round((calls / max) * 100);
};
</script>

<template>
  <el-card v-loading="loading" shadow="never" class="w-99/100 mb-3">
    <div class="flex flex-wrap items-center gap-4 mb-3">
      <span class="font-semibold">{{ t("aiConfig.dashboardTitle") }}</span>
      <span class="text-xs text-(--el-text-color-secondary)">
        {{ t("aiConfig.dashboardHint") }}
      </span>
    </div>
    <template v-if="hasUsageData">
      <div class="flex flex-wrap gap-10 mb-3">
        <div v-for="card in dashboardCards" :key="card.label">
          <div class="text-sm opacity-70">{{ card.label }}</div>
          <div class="text-2xl font-semibold">{{ card.value }}</div>
          <div
            v-if="card.hint"
            class="text-xs text-(--el-text-color-secondary)"
          >
            {{ card.hint }}
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-8">
        <div class="min-w-80 flex-1">
          <div class="text-sm opacity-70 mb-1">
            {{ t("aiConfig.dashboardTrend") }}
          </div>
          <ChartLine
            v-if="echartsReady && usageTrend.length > 1"
            :data="usageTrend"
          />
          <div
            v-else
            class="h-15 flex-c text-sm text-(--el-text-color-secondary)"
          >
            {{ t("aiConfig.dashboardEmpty") }}
          </div>
        </div>
        <div class="min-w-80 flex-1">
          <div class="text-sm opacity-70 mb-2">
            {{ t("aiConfig.dashboardByProfile") }}
          </div>
          <div
            v-for="row in usage?.by_profile || []"
            :key="row.profile_name"
            class="mb-2"
          >
            <div class="flex-bc gap-2 text-sm">
              <span class="truncate">{{ row.profile_name }}</span>
              <span class="shrink-0 opacity-70">
                {{ row.calls }} · {{ row.success_rate }}%
                <template v-if="row.avg_latency_ms !== null">
                  · {{ row.avg_latency_ms }} ms
                </template>
              </span>
            </div>
            <el-progress
              :percentage="dimensionPercent(row.calls, usage?.by_profile)"
              :show-text="false"
            />
          </div>
        </div>
        <div class="min-w-80 flex-1">
          <div class="text-sm opacity-70 mb-2">
            {{ t("aiConfig.dashboardByModel") }}
          </div>
          <div
            v-for="row in usage?.by_model || []"
            :key="row.model"
            class="mb-2"
          >
            <div class="flex-bc gap-2 text-sm">
              <span class="truncate">{{ row.model }}</span>
              <span class="shrink-0 opacity-70">
                {{ row.calls }} · {{ row.success_rate }}%
                <template v-if="row.avg_latency_ms !== null">
                  · {{ row.avg_latency_ms }} ms
                </template>
              </span>
            </div>
            <el-progress
              :percentage="dimensionPercent(row.calls, usage?.by_model)"
              :show-text="false"
            />
          </div>
        </div>
      </div>
    </template>
    <el-empty v-else :description="t('aiConfig.dashboardEmpty')" />
  </el-card>
</template>
