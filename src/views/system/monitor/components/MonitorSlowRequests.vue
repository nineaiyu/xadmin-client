<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { MonitorSlow } from "@/api/system/monitor";

/** 慢请求表格（24h 内耗时 ≥ threshold 秒的请求）：纯展示 */
defineProps<{
  rows: MonitorSlow["results"];
  threshold: number;
}>();

const { t } = useI18n();
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
    <el-table :data="rows" size="small">
      <el-table-column
        prop="module"
        :label="t('systemMonitor.module')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="path"
        :label="t('systemMonitor.path')"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        prop="method"
        :label="t('systemMonitor.method')"
        width="80"
      />
      <el-table-column
        prop="exec_time"
        :label="t('systemMonitor.cost')"
        width="90"
      >
        <template #default="{ row }"
          >{{ Number(row.exec_time).toFixed(3) }}s</template
        >
      </el-table-column>
      <el-table-column
        prop="status_code"
        :label="t('systemMonitor.statusCode')"
        width="90"
      />
      <el-table-column
        prop="creator__username"
        :label="t('systemMonitor.creator')"
        width="110"
      />
      <el-table-column
        prop="created_time"
        :label="t('systemMonitor.time')"
        width="170"
      />
    </el-table>
    <el-empty
      v-if="!rows.length"
      :description="t('systemMonitor.noSlowRequest')"
      :image-size="60"
    />
  </el-card>
</template>
