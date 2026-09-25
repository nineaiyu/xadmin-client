<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes } from "@pureadmin/utils";
import { loadEcharts } from "@/plugins/echarts";
import { epColor } from "@/utils/chartTheme";
import type { FileStats } from "../utils/hook";
import CategoryPieChart from "./CategoryPieChart.vue";
import UploadTrendChart from "./UploadTrendChart.vue";

defineOptions({ name: "FileStorageStats" });

const props = defineProps<{ stats: FileStats }>();
const { t } = useI18n();

/** echarts 懒加载就绪后再渲染图表（useECharts 初始化时同步读取 $echarts） */
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});

/** 使用率配色：<80 正常，80~95 警告，>=95 危险（与旧卡片同口径；EP 语义色跟随主题） */
const quotaColor = computed(() => {
  const rate = props.stats.usage_rate ?? 0;
  if (rate >= 95) return epColor("danger");
  if (rate >= 80) return epColor("warning");
  return epColor("primary");
});

const quotaPercent = computed(() =>
  Math.min(100, Math.round(props.stats.usage_rate ?? 0))
);

const metrics = computed(() => [
  {
    key: "used",
    label: t("systemUploadFile.usedSpace"),
    value: formatBytes(props.stats.total_size ?? 0)
  },
  {
    key: "remaining",
    label: t("systemUploadFile.remainingSpace"),
    // 无配额（0=不限）时后端给 null：显示「不限」而非误导性的 0
    value:
      props.stats.remaining_size == null
        ? t("systemUploadFile.unlimited")
        : formatBytes(props.stats.remaining_size)
  },
  {
    key: "count",
    label: t("systemUploadFile.fileCount"),
    value: String(props.stats.count ?? 0)
  },
  {
    key: "avg",
    label: t("systemUploadFile.avgSize"),
    value: formatBytes(props.stats.avg_size ?? 0)
  }
]);

const topFiles = computed(() => props.stats.top_files ?? []);
const shareOf = (filesize: number) => {
  const total = props.stats.total_size || 0;
  return total ? Math.round((filesize / total) * 100) : 0;
};
</script>

<template>
  <div>
    <el-row :gutter="16">
      <el-col :xs="24" :md="8" class="mb-4 md:mb-0">
        <el-card shadow="never" class="h-full">
          <template #header>{{ t("systemUploadFile.storageUsage") }}</template>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
            <el-progress
              type="dashboard"
              :width="118"
              :percentage="quotaPercent"
              :color="quotaColor"
            >
              <template #default>
                <!-- 无配额（0=不限）时不显示 0%，避免被误读为「未使用」 -->
                <div class="text-lg font-medium">
                  {{ stats.quota_mb ? `${quotaPercent}%` : "∞" }}
                </div>
                <div class="text-xs text-(--el-text-color-secondary)">
                  {{
                    stats.quota_mb
                      ? t("systemUploadFile.usageRate")
                      : t("systemUploadFile.unlimited")
                  }}
                </div>
              </template>
            </el-progress>
            <div class="grid min-w-40 flex-1 grid-cols-2 gap-x-4 gap-y-3">
              <div v-for="metric in metrics" :key="metric.key">
                <div class="text-xs text-(--el-text-color-secondary)">
                  {{ metric.label }}
                </div>
                <div
                  class="mt-0.5 truncate text-sm font-medium"
                  :title="metric.value"
                  :data-testid="`stat-${metric.key}`"
                >
                  {{ metric.value }}
                </div>
              </div>
            </div>
          </div>
          <div class="mt-3 text-xs text-(--el-text-color-secondary)">
            <template v-if="stats.quota_mb">
              {{ formatBytes(stats.total_size) }} / {{ stats.quota_mb }} MB
            </template>
            <template v-else>{{ t("systemUploadFile.quotaTip") }}</template>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8" class="mb-4 md:mb-0">
        <el-card shadow="never" class="h-full">
          <template #header>
            {{ t("systemUploadFile.categoryDist") }}
          </template>
          <category-pie-chart
            v-if="echartsReady"
            :items="stats.category_stats ?? []"
            :total-size="stats.total_size ?? 0"
          />
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="h-full">
          <template #header>
            {{ t("systemUploadFile.uploadTrend") }}
          </template>
          <upload-trend-chart
            v-if="echartsReady"
            :trend="stats.recent_trend ?? []"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mt-4">
      <template #header>{{ t("systemUploadFile.largestFiles") }}</template>
      <!-- 轻量自绘列表而非 el-table：避免与下方主列表的 .el-table__row 定位混淆 -->
      <div v-if="topFiles.length" class="flex flex-col gap-2">
        <div
          v-for="(file, index) in topFiles"
          :key="file.pk"
          class="flex items-center gap-3 text-sm"
        >
          <span
            class="w-5 shrink-0 text-center text-xs text-(--el-text-color-secondary)"
          >
            {{ index + 1 }}
          </span>
          <span class="min-w-0 flex-1 truncate" :title="file.filename">
            {{ file.filename }}
          </span>
          <el-progress
            class="hidden w-40 shrink-0 sm:block"
            :percentage="shareOf(file.filesize)"
            :stroke-width="8"
            :show-text="false"
            :color="quotaColor"
          />
          <span
            class="w-10 shrink-0 text-right text-xs text-(--el-text-color-secondary)"
          >
            {{ shareOf(file.filesize) }}%
          </span>
          <span class="w-24 shrink-0 text-right">
            {{ formatBytes(file.filesize) }}
          </span>
        </div>
      </div>
      <el-empty v-else :description="t('labels.noData')" :image-size="60" />
    </el-card>
  </div>
</template>
