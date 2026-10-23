<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { StatBar, type StatItem } from "@/components/ReStat";
import { epColor } from "@/utils/chartTheme";
import { buildFileStatsBarData, type FileStats } from "../utils/fileStats";

defineOptions({ name: "FileStatsBar" });

/**
 * 顶部紧凑指标条（常驻一行）：使用率 + 已用/剩余/文件数/平均大小，
 * 分类分布、上传趋势与最大文件见详情抽屉（FileStatsPanel）。
 *
 * 设计口径：列表页的主体是文件列表，统计属辅助信息——重型图表卡常驻顶部会把
 * 列表挤出首屏（实测统计区 605px，表格被自适应高度钳到最小 260px、首屏仅 5 行）。
 * 容器与指标 chips 版式由 ReStatBar 提供，使用率进度与详情入口走条内插槽。
 */
const props = defineProps<{ stats: FileStats }>();
const emit = defineEmits<{ detail: [] }>();

const { t } = useI18n();

const data = computed(() => buildFileStatsBarData(props.stats));

/** 使用率配色：<80 正常，80~95 警告，>=95 危险（与统计详情同口径） */
const quotaColor = computed(() => {
  if (data.value.percent >= 95) return epColor("danger");
  if (data.value.percent >= 80) return epColor("warning");
  return epColor("primary");
});

const metrics = computed<StatItem[]>(() => [
  {
    key: "used",
    label: t("systemUploadFile.usedSpace"),
    value: data.value.used
  },
  {
    key: "remaining",
    label: t("systemUploadFile.remainingSpace"),
    // 无配额（0=不限）时后端给 null：显示「不限」而非误导性的 0
    value: data.value.remaining ?? t("systemUploadFile.unlimited")
  },
  {
    key: "count",
    label: t("systemUploadFile.fileCount"),
    value: data.value.count
  },
  { key: "avg", label: t("systemUploadFile.avgSize"), value: data.value.avg }
]);

/** 使用率悬停提示：有配额给「已用 / 配额」，无配额说明「0 = 不限」的计入口径 */
const usageTip = computed(() =>
  data.value.hasQuota
    ? `${data.value.used} / ${props.stats.quota_mb} MB`
    : t("systemUploadFile.quotaTip")
);
</script>

<template>
  <StatBar :items="metrics" data-testid="file-stats-bar">
    <template #prefix>
      <div class="flex items-center gap-3" :title="usageTip">
        <span class="text-sm text-(--el-text-color-secondary)">
          {{ t("systemUploadFile.storageUsage") }}
        </span>
        <el-progress
          v-if="data.hasQuota"
          class="hidden w-28 sm:block"
          :percentage="data.percent"
          :color="quotaColor"
          :stroke-width="8"
          :show-text="false"
        />
        <span
          class="text-base font-semibold"
          :style="{ color: data.hasQuota ? quotaColor : undefined }"
          data-testid="stat-usage"
        >
          {{
            data.hasQuota ? `${data.percent}%` : t("systemUploadFile.unlimited")
          }}
        </span>
      </div>
    </template>

    <template #extra>
      <el-button
        link
        type="primary"
        data-testid="file-stats-detail"
        @click="emit('detail')"
      >
        {{ t("systemUploadFile.statsDetail") }}
      </el-button>
    </template>
  </StatBar>
</template>
