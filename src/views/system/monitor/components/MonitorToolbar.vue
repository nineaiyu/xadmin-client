<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { ArrowDown } from "@element-plus/icons-vue";

/**
 * 监控页工具条：连接状态 / 自动刷新 / 手动刷新 / 分享 / 报表导出。
 *
 * 纯展示 + 事件上抛：数据与动作（轮询、导出、分享）都由页面侧持有。
 */
defineProps<{
  wsConnected: boolean;
  autoRefresh: boolean;
  loading: boolean;
  exporting: boolean;
  canExport: boolean;
}>();

const emit = defineEmits<{
  "update:autoRefresh": [boolean];
  toggleAuto: [boolean];
  refresh: [];
  share: [];
  exportReport: [string];
}>();

const { t } = useI18n();
</script>

<template>
  <el-card shadow="never" class="mb-4">
    <div class="flex flex-wrap items-center gap-3">
      <span class="font-medium">{{ t("menus.systemMonitor") }}</span>
      <el-tag
        :type="wsConnected ? 'success' : 'info'"
        size="small"
        effect="plain"
      >
        {{
          wsConnected
            ? t("systemMonitor.wsLive")
            : t("systemMonitor.wsFallback")
        }}
      </el-tag>
      <div class="flex-1" />
      <el-switch
        :model-value="autoRefresh"
        :active-text="t('systemMonitor.autoRefresh')"
        @update:model-value="
          value => emit('update:autoRefresh', Boolean(value))
        "
        @change="value => emit('toggleAuto', Boolean(value))"
      />
      <el-button
        type="primary"
        plain
        :loading="loading"
        @click="emit('refresh')"
      >
        {{ t("systemMonitor.refresh") }}
      </el-button>
      <el-button plain data-testid="monitor-share" @click="emit('share')">
        {{ t("systemMonitor.share") }}
      </el-button>
      <el-dropdown
        v-if="canExport"
        @command="command => emit('exportReport', String(command))"
      >
        <el-button plain :loading="exporting" data-testid="monitor-export">
          {{ t("systemMonitor.exportReport") }}
          <el-icon class="ml-1"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="history:csv">
              {{ t("systemMonitor.exportHistoryCsv") }}
            </el-dropdown-item>
            <el-dropdown-item command="history:xlsx">
              {{ t("systemMonitor.exportHistoryXlsx") }}
            </el-dropdown-item>
            <el-dropdown-item command="alerts:csv">
              {{ t("systemMonitor.exportAlertsCsv") }}
            </el-dropdown-item>
            <el-dropdown-item command="alerts:xlsx">
              {{ t("systemMonitor.exportAlertsXlsx") }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-card>
</template>
