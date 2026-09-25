<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MonitorTaskHealth } from "@/api/system/monitor";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/**
 * 后台任务健康度卡片：成功率 / 健康色三档 / 高频任务 Top / 近期失败。
 * 独立组件避免监控主页（index.vue）超 400 行红线；数据由 useMonitor 统一拉取。
 */
const props = defineProps<{ health: MonitorTaskHealth | null }>();

const { t } = useI18n();

const STATE_META = {
  healthy: { tag: "success", key: "stateHealthy" },
  degraded: { tag: "warning", key: "stateDegraded" },
  failing: { tag: "danger", key: "stateFailing" }
} as const;

const stateMeta = computed(() => {
  const state = props.health?.state ?? "healthy";
  // 未知状态回退健康档：直接取键会拿到 undefined 致渲染崩溃
  return STATE_META[state] ?? STATE_META.healthy;
});

/** 卡片内嵌子表：补全表头（原实现列无 label，表头空一格）并取紧凑档 */
const perTaskColumns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "name",
    label: t("systemMonitor.taskName"),
    minWidth: 160,
    showOverflowTooltip: true
  },
  {
    prop: "total",
    label: t("systemMonitor.taskTotal"),
    width: 90,
    align: "center"
  },
  {
    label: t("systemMonitor.taskSuccessRate"),
    width: 110,
    align: "center",
    slot: "rate"
  }
]);

const failureColumns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "name",
    label: t("systemMonitor.taskName"),
    minWidth: 160,
    showOverflowTooltip: true
  },
  {
    label: t("systemMonitor.taskState"),
    width: 100,
    align: "center",
    slot: "status"
  },
  {
    prop: "date_finished",
    label: t("systemMonitor.taskFinished"),
    width: 170
  }
]);
</script>

<template>
  <el-card v-if="health" shadow="never">
    <template #header>
      <el-space>
        {{ t("systemMonitor.taskHealth", { n: health.window_days }) }}
        <el-tag :type="stateMeta.tag" size="small">
          {{ t(`systemMonitor.${stateMeta.key}`) }}
        </el-tag>
      </el-space>
    </template>
    <el-descriptions :column="4" size="small" border class="mb-3">
      <el-descriptions-item :label="t('systemMonitor.taskSuccessRate')">
        {{
          health.success_rate === null
            ? t("systemMonitor.taskSuccessRateNone")
            : `${(health.success_rate * 100).toFixed(2)}%`
        }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemMonitor.taskTotal')">
        {{ health.total }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemMonitor.taskRunning')">
        {{ health.running + health.pending }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemMonitor.taskAvgCost')">
        {{
          health.avg_cost_seconds === null
            ? "—"
            : `${health.avg_cost_seconds.toFixed(3)}s`
        }}
      </el-descriptions-item>
    </el-descriptions>

    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <p class="mb-1 text-sm font-bold">
          {{ t("systemMonitor.taskPerTask") }}
        </p>
        <ReReadonlyTable
          :columns="perTaskColumns"
          :rows="health.per_task"
          size="small"
          max-height="220"
        >
          <template #rate="{ row }">
            {{
              row.success_rate === null
                ? "—"
                : `${(row.success_rate * 100).toFixed(1)}%`
            }}
          </template>
        </ReReadonlyTable>
      </el-col>
      <el-col :xs="24" :md="12">
        <p class="mb-1 text-sm font-bold">
          {{ t("systemMonitor.taskRecentFailures") }}
        </p>
        <ReReadonlyTable
          :columns="failureColumns"
          :rows="health.recent_failures"
          size="small"
          max-height="220"
          :empty-text="t('systemMonitor.taskNoFailures')"
        >
          <template #status="{ row }">
            <el-tag
              :type="row.status === 'FAILURE' ? 'danger' : 'info'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </ReReadonlyTable>
      </el-col>
    </el-row>
  </el-card>
</template>
