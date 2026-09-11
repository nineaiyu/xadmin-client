<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MonitorTaskHealth } from "@/api/system/monitor";

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
  return STATE_META[state];
});
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
        <el-table :data="health.per_task" size="small" max-height="220">
          <el-table-column prop="name" show-overflow-tooltip />
          <el-table-column prop="total" width="80" align="center" />
          <el-table-column width="90" align="center">
            <template #default="{ row }">
              {{
                row.success_rate === null
                  ? "—"
                  : `${(row.success_rate * 100).toFixed(1)}%`
              }}
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      <el-col :xs="24" :md="12">
        <p class="mb-1 text-sm font-bold">
          {{ t("systemMonitor.taskRecentFailures") }}
        </p>
        <el-table
          v-if="health.recent_failures.length"
          :data="health.recent_failures"
          size="small"
          max-height="220"
        >
          <el-table-column prop="name" show-overflow-tooltip />
          <el-table-column prop="status" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'FAILURE' ? 'danger' : 'info'"
                size="small"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="date_finished" width="160" />
        </el-table>
        <el-empty
          v-else
          :description="t('systemMonitor.taskNoFailures')"
          :image-size="60"
        />
      </el-col>
    </el-row>
  </el-card>
</template>
