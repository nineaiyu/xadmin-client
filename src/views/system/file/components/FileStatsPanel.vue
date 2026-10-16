<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes } from "@pureadmin/utils";
import { loadEcharts } from "@/plugins/echarts";
import { epColor } from "@/utils/chartTheme";
import type { FileStats } from "../utils/fileStats";
import CategoryPieChart from "./CategoryPieChart.vue";
import UploadTrendChart from "./UploadTrendChart.vue";

defineOptions({ name: "FileStatsPanel" });

/**
 * 文件统计详情（抽屉内容）：分类分布 + 近 7 天上传 + 占用最大的文件。
 *
 * 图表等重型展示从列表页顶部搬进抽屉：常驻顶部会把文件列表挤出首屏
 * （顶部指标见 FileStatsBar）。
 */
const props = defineProps<{ stats: FileStats }>();
const { t } = useI18n();

/** echarts 懒加载就绪后再渲染图表（useECharts 初始化时同步读取 $echarts） */
const echartsReady = ref(false);
onMounted(async () => {
  await loadEcharts();
  echartsReady.value = true;
});

/** 使用率配色：与顶部指标条同口径（<80 正常，80~95 警告，>=95 危险） */
const quotaColor = computed(() => {
  const rate = props.stats.usage_rate ?? 0;
  if (rate >= 95) return epColor("danger");
  if (rate >= 80) return epColor("warning");
  return epColor("primary");
});

const topFiles = computed(() => props.stats.top_files ?? []);
const shareOf = (filesize: number) => {
  const total = props.stats.total_size || 0;
  return total ? Math.round((filesize / total) * 100) : 0;
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <el-card shadow="never">
      <template #header>{{ t("systemUploadFile.categoryDist") }}</template>
      <!-- 固定内容高度：抽屉内图表高度不可随分类条目数无限增长（超出部分内部滚动） -->
      <div class="h-60">
        <category-pie-chart
          v-if="echartsReady"
          :items="stats.category_stats ?? []"
          :total-size="stats.total_size ?? 0"
        />
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>{{ t("systemUploadFile.uploadTrend") }}</template>
      <div class="h-52">
        <upload-trend-chart
          v-if="echartsReady"
          :trend="stats.recent_trend ?? []"
        />
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>{{ t("systemUploadFile.largestFiles") }}</template>
      <!-- 轻量自绘列表而非 el-table：避免与主列表的 .el-table__row 定位混淆 -->
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
      <ReEmpty v-else :description="t('labels.noData')" :image-size="60" />
    </el-card>
  </div>
</template>
