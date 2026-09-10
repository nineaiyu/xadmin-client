<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes } from "@pureadmin/utils";
import { useSystemUploadFile } from "./utils/hook";

defineOptions({
  name: "SystemUploadFile"
});

const { t } = useI18n();

const tableRef = ref();

const {
  api,
  auth,
  stats,
  searchColumnsFormat,
  listColumnsFormat,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps
} = useSystemUploadFile(tableRef);

// 配额使用率阈值配色：<80 正常，80~95 警告，>=95 危险
const quotaColor = computed(() => {
  const rate = stats.value?.usage_rate ?? 0;
  if (rate >= 95) return "#f56c6c";
  if (rate >= 80) return "#e6a23c";
  return "#409eff";
});
</script>

<template>
  <div class="file-center">
    <el-card v-if="auth.list && stats" shadow="never" class="mx-3 mb-2!">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span class="font-medium">{{
          t("systemUploadFile.storageUsage")
        }}</span>
        <el-progress
          v-if="stats.quota_mb"
          class="min-w-50 flex-1"
          :percentage="Math.min(100, stats.usage_rate)"
          :stroke-width="12"
          :color="quotaColor"
        />
        <span class="text-sm text-gray-500">
          {{ formatBytes(stats.total_size)
          }}<template v-if="stats.quota_mb">
            / {{ stats.quota_mb }} MB</template
          >
        </span>
        <el-tag type="info" size="small" effect="plain">
          {{ t("systemUploadFile.fileCount") }}: {{ stats.count }}
        </el-tag>
        <el-text type="info" size="small" class="basis-full">
          {{ t("systemUploadFile.quotaTip") }}
        </el-text>
      </div>
    </el-card>
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemUploadFile"
      :searchColumnsFormat="searchColumnsFormat"
      :listColumnsFormat="listColumnsFormat"
      :addOrEditOptions="addOrEditOptions"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
      recycleBin
    />
  </div>
</template>
