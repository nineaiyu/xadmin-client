<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { formatBytes, useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import type { FileCategoryStat } from "../utils/hook";
import { fallbackColor, waitChartSized } from "../utils/chart";

defineOptions({ name: "FileCategoryPieChart" });

const props = defineProps<{
  items: FileCategoryStat[];
  totalSize: number;
}>();

const { t } = useI18n();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 展示行：分类名与颜色（字典项已删除/未分类时给出可读兜底） */
const rows = computed(() =>
  props.items.map((item, index) => ({
    ...item,
    label:
      item.value == null
        ? t("systemUploadFile.uncategorized")
        : item.label || item.value,
    color: item.color || fallbackColor(index)
  }))
);

const sizeTotal = computed(() =>
  props.items.reduce((sum, item) => sum + (Number(item.size) || 0), 0)
);
const countTotal = computed(() =>
  props.items.reduce((sum, item) => sum + (Number(item.count) || 0), 0)
);
/** 容量全为 0（空文件）时退化为数量占比：否则饼图没有任何形状 */
const useCount = computed(() => sizeTotal.value <= 0);
const shareTotal = computed(() =>
  useCount.value ? countTotal.value : sizeTotal.value
);

const shareOf = (item: FileCategoryStat) => {
  if (!shareTotal.value) return 0;
  const value = useCount.value
    ? Number(item.count) || 0
    : Number(item.size) || 0;
  return Math.round((value / shareTotal.value) * 100);
};

const buildOptions = (): UtilsEChartsOption => ({
  title: {
    text: formatBytes(props.totalSize),
    subtext: t("systemUploadFile.totalSize"),
    left: "50%",
    top: "40%",
    textAlign: "center",
    textStyle: { fontSize: 14, fontWeight: 600 },
    subtextStyle: { fontSize: 11 }
  },
  tooltip: {
    trigger: "item",
    formatter: params => {
      const data = (params.data ?? {}) as Record<string, number>;
      return [
        params.name,
        `${t("systemUploadFile.size")}: ${formatBytes(data.size || 0)}`,
        `${t("systemUploadFile.fileCount")}: ${data.count || 0}`,
        `${params.percent ?? 0}%`
      ].join("<br/>");
    }
  },
  series: [
    {
      type: "pie",
      radius: ["60%", "82%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: {
        borderWidth: 2,
        // 环形扇区间留白：边框取卡片底色，深浅色主题各一档
        borderColor: isDark.value ? "#1d1e1f" : "#ffffff"
      },
      label: { show: false },
      labelLine: { show: false },
      data: rows.value.map(row => ({
        name: row.label,
        value: useCount.value ? Number(row.count) || 0 : Number(row.size) || 0,
        itemStyle: { color: row.color },
        count: row.count,
        size: row.size
      }))
    }
  ]
});

let mounted = false;
onMounted(async () => {
  await nextTick();
  if (!(await waitChartSized(() => chartRef.value as HTMLElement))) return;
  mounted = true;
  setOptions(buildOptions());
});

watch(
  [() => props.items, () => props.totalSize, () => isDark.value],
  () => {
    if (mounted) setOptions(buildOptions());
  },
  { deep: true }
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div ref="chartRef" class="h-37.5 w-full shrink-0" />
    <div class="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto">
      <div
        v-for="row in rows"
        :key="String(row.value)"
        class="flex items-center gap-2 text-xs"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: row.color }"
        />
        <span class="min-w-0 flex-1 truncate" :title="row.label">
          {{ row.label }}
        </span>
        <span
          class="shrink-0 text-gray-400"
          :title="t('systemUploadFile.fileCount')"
        >
          {{ row.count }}
        </span>
        <span class="w-16 shrink-0 text-right">
          {{ formatBytes(row.size) }}
        </span>
        <span class="w-9 shrink-0 text-right text-gray-400">
          {{ shareOf(row) }}%
        </span>
      </div>
      <el-empty
        v-if="!rows.length"
        :description="t('labels.noData')"
        :image-size="40"
      />
    </div>
  </div>
</template>
