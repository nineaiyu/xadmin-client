<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MonitorSlow } from "@/api/system/monitor";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/** 慢请求表格（24h 内耗时 ≥ threshold 秒的请求）：纯展示 */
defineProps<{
  rows: MonitorSlow["results"];
  threshold: number;
}>();

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
  { prop: "created_time", label: t("systemMonitor.time"), width: 170 }
]);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <span>
          {{ t("systemMonitor.slowRequests") }}
          (≥ {{ threshold }}s / 24h)
        </span>
      </div>
    </template>
    <ReReadonlyTable
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
