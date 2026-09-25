<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  ApiApplicationItem,
  ApplicationUsageStats
} from "@/api/system/open";

/**
 * 应用用量抽屉：近 N 天调用量 / 失败数 / 平均耗时 + Top 路径 +
 * 业务码分布 + 当日配额用量（软口径，不阻断请求）。
 */
defineOptions({ name: "ApiApplicationUsageDrawer" });

const props = defineProps<{
  modelValue: boolean;
  row?: ApiApplicationItem | null;
  loading?: boolean;
  data?: ApplicationUsageStats | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const { t } = useI18n();

const visible = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value)
});

const quotaPercent = computed(() => {
  const quota = props.data?.quota;
  if (!quota?.daily_quota) return 0;
  return Math.min(
    100,
    Math.round((quota.used_today / quota.daily_quota) * 100)
  );
});

const quotaStatus = computed(() => {
  const quota = props.data?.quota;
  if (!quota?.daily_quota) return undefined;
  const threshold = quota.alert_percent ?? 80;
  if (quotaPercent.value >= 100) return "exception";
  if (quotaPercent.value >= threshold) return "warning";
  return "success";
});

const durationText = (value: number) => `${(value * 1000).toFixed(1)} ms`;
</script>

<template>
  <el-drawer v-model="visible" :size="560" :title="t('apiApp.usage.title')">
    <div v-loading="loading" class="usage-body">
      <template v-if="data">
        <div class="usage-row">
          <div class="usage-card">
            <div class="usage-label">{{ t("apiApp.usage.total") }}</div>
            <div class="usage-value">{{ data.total }}</div>
          </div>
          <div class="usage-card">
            <div class="usage-label">{{ t("apiApp.usage.failed") }}</div>
            <div class="usage-value usage-danger">{{ data.failed }}</div>
          </div>
          <div class="usage-card">
            <div class="usage-label">{{ t("apiApp.usage.avgDuration") }}</div>
            <div class="usage-value">{{ durationText(data.avg_duration) }}</div>
          </div>
        </div>

        <div v-if="data.quota.daily_quota > 0" class="usage-section">
          <div class="usage-section-title">
            {{ t("apiApp.usage.quota") }}
          </div>
          <el-progress
            :percentage="quotaPercent"
            :status="quotaStatus"
            :stroke-width="14"
          />
          <div class="usage-note">
            {{
              t("apiApp.usage.quotaDetail", {
                used: data.quota.used_today,
                quota: data.quota.daily_quota,
                percent: data.quota.alert_percent
              })
            }}
          </div>
        </div>

        <div class="usage-section">
          <div class="usage-section-title">
            {{ t("apiApp.usage.daily") }}
          </div>
          <el-table :data="data.daily" size="small" max-height="220">
            <el-table-column prop="date" :label="t('apiApp.usage.date')" />
            <el-table-column prop="total" :label="t('apiApp.usage.total')" />
            <el-table-column prop="failed" :label="t('apiApp.usage.failed')" />
            <el-table-column
              :label="t('apiApp.usage.avgDuration')"
              :formatter="row => durationText(row.avg_duration)"
            />
          </el-table>
        </div>

        <div class="usage-section">
          <div class="usage-section-title">
            {{ t("apiApp.usage.topPaths") }}
          </div>
          <el-table :data="data.top_paths" size="small" max-height="220">
            <el-table-column prop="path" label="Path" show-overflow-tooltip />
            <el-table-column
              prop="total"
              :label="t('apiApp.usage.total')"
              width="90"
            />
          </el-table>
        </div>

        <div class="usage-section">
          <div class="usage-section-title">
            {{ t("apiApp.usage.statusCodes") }}
          </div>
          <el-table :data="data.status_codes" size="small" max-height="200">
            <el-table-column
              prop="status_code"
              :label="t('apiApp.usage.statusCode')"
            />
            <el-table-column
              prop="total"
              :label="t('apiApp.usage.total')"
              width="90"
            />
          </el-table>
        </div>
      </template>
      <ReEmpty v-else-if="!loading" :description="t('apiApp.usage.empty')" />
    </div>
  </el-drawer>
</template>

<style lang="scss" scoped>
.usage-body {
  min-height: 200px;
}

.usage-row {
  display: flex;
  gap: 12px;
}

.usage-card {
  flex: 1;
  padding: 12px;
  text-align: center;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.usage-label {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.usage-value {
  margin-top: 4px;
  font-size: var(--el-font-size-extra-large);
  font-weight: 600;
}

.usage-danger {
  color: var(--el-color-danger);
}

.usage-section {
  margin-top: 18px;
}

.usage-section-title {
  margin-bottom: 8px;
  font-size: var(--el-font-size-small);
  font-weight: 600;
}

.usage-note {
  margin-top: 6px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
