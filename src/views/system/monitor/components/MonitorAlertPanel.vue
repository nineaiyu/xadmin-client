<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type {
  MonitorAlertEvent,
  MonitorThresholds
} from "@/api/system/monitor";
import { metricLabelKey } from "../utils/format";

/**
 * 告警记录面板：状态筛选 + 阈值快照 + 记录表格。
 *
 * 筛选状态经 `v-model:status` 双向绑定（页面侧据此拉取），阈值设置由上抛事件触发。
 */
defineProps<{
  rows: MonitorAlertEvent[];
  counts: { firing: number };
  thresholds: MonitorThresholds | null;
  canUpdateThreshold: boolean;
  status: "" | "firing" | "resolved";
}>();

const emit = defineEmits<{
  "update:status": ["" | "firing" | "resolved"];
  openThreshold: [];
}>();

const { t } = useI18n();

const alertItemLabel = (item: string) => t(metricLabelKey(item));
const alertStatusType = (status: string) =>
  status === "firing" ? "danger" : "success";

/** el-radio-group 的值类型是宽联合，收敛回页面侧的筛选状态类型 */
const onStatusChange = (value: string | number | boolean | undefined) =>
  emit("update:status", (value ?? "") as "" | "firing" | "resolved");
</script>

<template>
  <el-card shadow="never" class="mb-4" data-testid="monitor-alert-panel">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <span>{{ t("systemMonitor.alertsTitle") }}</span>
        <el-tag v-if="counts.firing" type="danger" size="small">
          {{ t("systemMonitor.alertsFiring") }} {{ counts.firing }}
        </el-tag>
        <el-radio-group
          :model-value="status"
          size="small"
          @update:model-value="onStatusChange"
        >
          <el-radio-button value="">
            {{ t("systemMonitor.alertFilterAll") }}
          </el-radio-button>
          <el-radio-button value="firing">
            {{ t("systemMonitor.alertFiring") }}
          </el-radio-button>
          <el-radio-button value="resolved">
            {{ t("systemMonitor.alertResolved") }}
          </el-radio-button>
        </el-radio-group>
        <div class="flex-1" />
        <el-button
          v-if="canUpdateThreshold"
          link
          type="primary"
          data-testid="monitor-threshold-settings"
          @click="emit('openThreshold')"
        >
          {{ t("systemMonitor.thresholdSettings") }}
        </el-button>
      </div>
    </template>
    <div class="mb-3 flex flex-wrap gap-2">
      <el-tag
        v-for="item in thresholds?.items ?? []"
        :key="item.key"
        size="small"
        effect="plain"
        type="info"
      >
        {{ item.label }}：{{ item.value }}
      </el-tag>
      <span class="text-xs text-gray-400">
        {{
          t("systemMonitor.thresholdCheckTip", {
            seconds: thresholds?.check_interval_seconds ?? 60
          })
        }}
      </span>
    </div>
    <el-table :data="rows" size="small">
      <el-table-column
        prop="item"
        :label="t('systemMonitor.alertItem')"
        width="120"
      >
        <template #default="{ row }">{{ alertItemLabel(row.item) }}</template>
      </el-table-column>
      <el-table-column
        prop="status"
        :label="t('systemMonitor.alertStatus')"
        width="100"
      >
        <template #default="{ row }">
          <el-tag :type="alertStatusType(row.status)" size="small">
            {{
              row.status === "firing"
                ? t("systemMonitor.alertFiring")
                : t("systemMonitor.alertResolved")
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="value"
        :label="t('systemMonitor.alertValue')"
        width="110"
      />
      <el-table-column
        prop="threshold"
        :label="t('systemMonitor.alertThreshold')"
        width="90"
      />
      <el-table-column
        prop="count"
        :label="t('systemMonitor.alertCount')"
        width="90"
      />
      <el-table-column
        prop="first_time"
        :label="t('systemMonitor.alertFirstTime')"
        width="170"
      />
      <el-table-column
        prop="last_time"
        :label="t('systemMonitor.alertLastTime')"
        width="170"
      />
      <el-table-column
        prop="resolved_time"
        :label="t('systemMonitor.alertResolvedTime')"
        width="170"
      >
        <template #default="{ row }">{{ row.resolved_time ?? "—" }}</template>
      </el-table-column>
      <el-table-column
        prop="message"
        :label="t('systemMonitor.alertMessage')"
        min-width="200"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ row.message || "—" }}</template>
      </el-table-column>
    </el-table>
    <el-empty
      v-if="!rows.length"
      :description="t('systemMonitor.noAlert')"
      :image-size="60"
    />
  </el-card>
</template>
