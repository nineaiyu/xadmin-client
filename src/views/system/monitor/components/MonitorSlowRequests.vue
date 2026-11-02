<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatDateTime } from "@/utils/format";
import type { MonitorSlow } from "@/api/system/monitor";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/** 慢请求表格（24h 内耗时 ≥ threshold 秒的请求）：纯展示 */
defineProps<{
  rows: MonitorSlow["results"];
  threshold: number;
  /** 该区块接口失败：显示「不可用 + 重试」，不把未知渲染成「无慢请求」 */
  unavailable?: boolean;
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n();

/** 面板内嵌密集表：显式取紧凑档（此处密度优先于与列表页行高对齐） */
const columns = computed<ReadonlyColumn[]>(() => [
  {
    prop: "module",
    label: t("systemMonitor.module"),
    minWidth: 160,
    showOverflowTooltip: true
  },
  {
    prop: "path",
    label: t("systemMonitor.path"),
    minWidth: 220,
    showOverflowTooltip: true
  },
  { prop: "method", label: t("systemMonitor.method"), width: 80 },
  { label: t("systemMonitor.cost"), width: 100, slot: "cost" },
  { prop: "status_code", label: t("systemMonitor.statusCode"), width: 90 },
  { prop: "creator__username", label: t("systemMonitor.creator"), width: 110 },
  {
    prop: "created_time",
    label: t("systemMonitor.time"),
    width: 170,
    formatter: (row: { created_time?: string }) =>
      formatDateTime(row.created_time)
  }
]);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <span>
          {{ t("systemMonitor.slowRequests") }}
          {{
            t("systemMonitor.slowWindow", {
              threshold
            })
          }}
        </span>
      </div>
    </template>
    <template v-if="unavailable">
      <el-alert
        :title="t('systemMonitor.dataUnavailable')"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-button class="mt-3" size="small" @click="emit('retry')">
        {{ t("systemMonitor.refresh") }}
      </el-button>
    </template>
    <ReReadonlyTable
      v-else
      :columns="columns"
      :rows="rows"
      size="small"
      :empty-text="t('systemMonitor.noSlowRequest')"
    >
      <template #cost="{ row }">
        {{ Number(row.exec_time).toFixed(3) }}s
      </template>
    </ReReadonlyTable>
  </el-card>
</template>
