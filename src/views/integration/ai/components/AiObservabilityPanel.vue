<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AiUsageDimensionStat } from "@/api/ai/ai";
import { loadEcharts } from "@/plugins/echarts";
import { ReNormalCountTo } from "@/components/ReCountTo";
import { useAiUsage } from "../hooks/useAiUsage";

/**
 * 用量观测面板：统计卡（调用数 / Token / 失败 / 并发占用）+ 日趋势 + 档案与
 * 模型分布。数据源为单一 usage 请求（useAiUsage），周期切换只重拉一次。
 *
 * - 统计卡对齐 ApprovalStats 范式（el-statistic + grid 等分，数字滚动）；
 * - 日趋势图表懒加载（echarts 与 ChartLine 均按需，同 welcome 页图表形态）；
 * - 延迟 P95 抽样不足时显式提示（小样本分位数误导），均值照常给出；
 * - 无用量数据（总调用 0）整体降级为 empty，不用空统计卡撑场。
 */
defineOptions({
  name: "AiObservabilityPanel"
});

const props = defineProps<{
  /** 统计周期（天）；缺省 7 天。切换入口在面板头部 */
  days?: number;
}>();

const { t } = useI18n();

const { usage, loading, usageDays, loadUsageWithDays } = useAiUsage(props.days);

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

const hasUsageData = computed(() => (usage.value?.total_calls ?? 0) > 0);

const statCards = computed(() => {
  const data = usage.value;
  const quotaStreams = data?.quota?.concurrent_streams || "∞";
  return [
    {
      key: "calls",
      label: t("aiConfig.usageCalls"),
      value: data?.total_calls ?? 0
    },
    {
      key: "tokens",
      label: t("aiConfig.usageTokens"),
      value: data?.total_tokens ?? 0
    },
    {
      key: "failed",
      label: t("aiConfig.usageFailed"),
      value: data?.failed ?? 0
    },
    {
      key: "rate",
      label: t("aiConfig.dashboardRate"),
      // 无调用（total=0）时成功率显示「—」而非 0%：避免被误读为「全部失败」
      text: data ? `${data.success_rate}%` : "—"
    },
    {
      key: "latency",
      label: t("aiConfig.dashboardAvg"),
      text: latencyText(data?.avg_latency_ms)
    },
    {
      key: "p95",
      label: t("aiConfig.dashboardP95"),
      text: latencyText(data?.p95_latency_ms)
    },
    {
      key: "streams",
      label: t("aiConfig.quotaStreams"),
      text: `${data?.stream_slots ?? 0}/${quotaStreams}`
    },
    {
      key: "users",
      label: t("aiConfig.usageTopUsers"),
      text: String(data?.top_users?.length ?? 0)
    }
  ];
});

/** 延迟展示：无样本（null）渲染占位符，不把 null 显示成 0 */
const latencyText = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value} ms`;

/** P95 抽样不足提示：样本不够时 RTP95 分位数不稳定，均值仍可参考 */
const p95Hint = computed(() =>
  usage.value && usage.value.p95_latency_ms === null
    ? t("aiConfig.dashboardP95LowSample")
    : ""
);

const usageTrend = computed(() =>
  (usage.value?.by_day ?? []).map(row => row.calls)
);

const trendDates = computed(() =>
  (usage.value?.by_day ?? []).map(row => row.day)
);

/** 维度分布（档案 / 模型）：按调用数取最大值归一化，el-progress 条形 */
const dimensionPercent = (
  calls: number,
  rows: AiUsageDimensionStat[] | undefined
) => {
  const max = Math.max(1, ...(rows ?? []).map(row => row.calls));
  return Math.round((calls / max) * 100);
};
</script>

<template>
  <div v-loading="loading">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <span class="text-(--el-text-color-secondary) text-sm">
        {{ t("aiConfig.usageHint") }}
      </span>
      <el-radio-group
        :model-value="usageDays"
        size="small"
        class="ml-auto"
        @change="loadUsageWithDays"
      >
        <el-radio-button v-for="day in [7, 30]" :key="day" :value="day">{{
          day
        }}</el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="hasUsageData">
      <!-- 统计卡等分（el-statistic + grid，对齐 ApprovalStats；窄屏 2 列回退） -->
      <div class="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 mb-5">
        <el-statistic
          v-for="card in statCards"
          :key="card.key"
          :title="card.label"
        >
          <template #default>
            <span v-if="card.text !== undefined">{{ card.text }}</span>
            <ReNormalCountTo v-else :duration="600" :endVal="card.value ?? 0" />
          </template>
        </el-statistic>
      </div>

      <p v-if="p95Hint" class="text-xs text-(--el-text-color-secondary) mb-3">
        {{ p95Hint }}
      </p>

      <div class="flex flex-col gap-6 xl:flex-row">
        <!-- 日调用趋势：echarts 懒加载未就绪时等高骨架占位（防塌陷） -->
        <div class="flex-1">
          <div class="text-sm text-(--el-text-color-secondary) mb-1">
            {{ t("aiConfig.dashboardTrend") }}
          </div>
          <template v-if="echartsReady && usageTrend.length > 1">
            <ChartLine :data="usageTrend" />
            <div class="text-xs text-(--el-text-color-secondary) mt-1">
              {{ trendDates[0] }} ~ {{ trendDates[trendDates.length - 1] }}
            </div>
          </template>
          <div
            v-else-if="echartsReady"
            class="h-15 flex-c text-sm text-(--el-text-color-secondary)"
          >
            {{ t("aiConfig.dashboardEmpty") }}
          </div>
        </div>

        <!-- 按档案分布 -->
        <div class="flex-1">
          <div class="text-sm text-(--el-text-color-secondary) mb-2">
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
          <p
            v-if="!(usage?.by_profile || []).length"
            class="text-sm text-(--el-text-color-secondary)"
          >
            {{ t("aiConfig.dashboardEmpty") }}
          </p>
        </div>

        <!-- 按模型分布 -->
        <div class="flex-1">
          <div class="text-sm text-(--el-text-color-secondary) mb-2">
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
          <p
            v-if="!(usage?.by_model || []).length"
            class="text-sm text-(--el-text-color-secondary)"
          >
            {{ t("aiConfig.dashboardEmpty") }}
          </p>
        </div>
      </div>
    </template>

    <el-empty v-else :description="t('aiConfig.dashboardEmpty')" />
  </div>
</template>
