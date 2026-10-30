<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import type { AiDailyReport } from "@/api/ai/ai";

/**
 * 首页「AI 日报」卡（提案 P2）：只读站点摘要——指标芯片实时聚合，摘要文本
 * 来自每日定时任务（LLM）。异常项点击直达对应页面；开关关闭时整卡不渲染
 * （父级 v-if）。无写操作入口，守住受限动作边界。
 */
defineOptions({ name: "AiDailyReportCard" });

const props = defineProps<{ report: AiDailyReport }>();

const { t } = useI18n();
const router = useRouter();

type AiDailyMetrics = NonNullable<AiDailyReport["metrics"]>;
type DailyChip = {
  key: keyof AiDailyMetrics;
  label: string;
  link: string | undefined;
  anomaly: boolean;
};

/** 指标芯片：key 对应后端 metrics 键；anomaly = 非零时按警示色渲染 */
const chips = computed<DailyChip[]>(() => [
  {
    key: "approval_pending",
    label: t("welcome.aiDailyPending"),
    link: props.report.links?.approvals,
    anomaly: false
  },
  {
    key: "monitor_firing",
    label: t("welcome.aiDailyAlerts"),
    link: props.report.links?.monitor,
    anomaly: true
  },
  {
    key: "error_requests_24h",
    label: t("welcome.aiDailyErrors"),
    link: props.report.links?.operation_log,
    anomaly: true
  },
  {
    key: "task_failed_24h",
    label: t("welcome.aiDailyTasks"),
    link: props.report.links?.tasks,
    anomaly: true
  },
  {
    key: "ai_calls_24h",
    label: t("welcome.aiDailyCalls"),
    link: props.report.links?.ai_usage,
    anomaly: false
  }
]);

const metricValue = (key: keyof AiDailyMetrics) =>
  props.report.metrics?.[key] ?? 0;
const chipTone = (anomaly: boolean, key: keyof AiDailyMetrics) =>
  anomaly && metricValue(key) > 0 ? "danger" : "info";

const generatedAt = computed(() =>
  props.report.generated_at
    ? t("welcome.aiDailyGeneratedAt", {
        time: dayjs(props.report.generated_at).format("HH:mm")
      })
    : ""
);

const summaryState = computed<"ready" | "empty" | "failed">(() => {
  if (props.report.summary) return "ready";
  return props.report.summary_error ? "failed" : "empty";
});

const visit = (link?: string) => {
  if (link) router.push(link);
};
</script>

<template>
  <el-card class="app-card" shadow="never" data-testid="ai-daily-report">
    <div class="flex-bc flex-wrap gap-y-1">
      <span class="text-md font-medium">{{ t("welcome.aiDailyTitle") }}</span>
      <span class="text-xs text-fg-muted">
        {{ generatedAt || t("welcome.aiDailyEmpty") }}
      </span>
    </div>
    <p
      v-if="summaryState === 'ready'"
      class="mt-3 text-sm/6 wrap-break-word"
      data-testid="ai-daily-report-summary"
    >
      {{ report.summary }}
    </p>
    <p v-else-if="summaryState === 'failed'" class="mt-3 text-sm text-fg-muted">
      {{ t("welcome.aiDailyFailed") }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <el-tag
        v-for="chip in chips"
        :key="chip.key"
        :type="chipTone(chip.anomaly, chip.key)"
        :class="chip.link ? 'cursor-pointer' : ''"
        :data-testid="`ai-daily-report-metric-${chip.key}`"
        @click="visit(chip.link)"
      >
        {{ chip.label }}
        <span class="ml-1 font-semibold">{{ metricValue(chip.key) }}</span>
      </el-tag>
    </div>
  </el-card>
</template>
