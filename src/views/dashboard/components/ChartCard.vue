<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ReSkeleton from "@/components/ReSkeleton";
import { useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import {
  datasetApi,
  type AggregateResult,
  type DashboardCard,
  type ExecuteResult
} from "@/api/system/datasets";
import {
  CHART_ACCENT,
  cssVarColor,
  epColor,
  withAlpha
} from "@/utils/chartTheme";
// 仅类型引用（不进包）：导出实现按需动态加载（保持首屏体积）
import type { EChartsLike, ExportedImage } from "@/utils/imageExport";

defineOptions({ name: "DashboardChartCard" });

const props = defineProps<{ card: DashboardCard }>();

const { t } = useI18n();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const loading = ref(false);
const total = ref(0);
/** 加载失败原因：图表/数字区域改为可读提示 + 重试（业务码非 1000 与网络异常统一收敛） */
const errorMsg = ref("");
/** 解构 resize：容器尺寸（卡片高度/宽度档位）变化后手动重算，window resize 监听不覆盖容器变化 */
const { setOptions, resize, getInstance } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 容器非 0 宽高等待（路由过渡期 DOM 尺寸为 0 会报错且不自愈），照抄 TrendChart */
const waitSized = async (): Promise<boolean> => {
  for (let i = 0; i < 30; i += 1) {
    const el = chartRef.value as HTMLElement | undefined;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) return true;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
};

/** 分类色板：EP 语义色跟随主题（第 6 色为图表专用强调色，集中定义于 chartTheme）；调用时读取 */
const palette = () => [
  epColor("primary"),
  epColor("success"),
  epColor("warning"),
  epColor("danger"),
  epColor("info"),
  CHART_ACCENT
];

const buildSeriesOptions = (result: AggregateResult): UtilsEChartsOption => {
  const names = result.series.map(item => item.name);
  const values = result.series.map(item => Number(item.value ?? 0));
  // tooltip 统一样式：底色/边框/文字取主题变量，暗色卡片上不再出现白底黑字
  const overlay = cssVarColor("--el-bg-color-overlay", "#ffffff");
  const tooltipStyle = {
    backgroundColor: overlay,
    borderColor: cssVarColor("--el-border-color-lighter", "#ebeef5"),
    textStyle: { color: cssVarColor("--el-text-color-primary", "#303133") }
  };
  if (props.card.chart_type === "pie") {
    const colors = palette();
    return {
      tooltip: { trigger: "item", ...tooltipStyle },
      legend: { bottom: 0, icon: "circle" },
      series: [
        {
          name: props.card.title,
          type: "pie",
          radius: ["38%", "62%"],
          // 扇区间留白 + 圆角：默认相邻扇区紧贴，深底上层次感不足
          itemStyle: { borderColor: overlay, borderWidth: 2, borderRadius: 4 },
          data: result.series.map((item, index) => ({
            name: item.name || "-",
            value: Number(item.value ?? 0),
            itemStyle: { color: colors[index % colors.length] }
          }))
        }
      ]
    };
  }
  const isLine = props.card.chart_type === "line";
  const primary = epColor("primary");
  return {
    tooltip: { trigger: "axis", ...tooltipStyle },
    grid: { top: "24px", left: "48px", right: "24px", bottom: "36px" },
    xAxis: { type: "category", boundaryGap: !isLine, data: names },
    yAxis: { type: "value" },
    series: [
      {
        name: props.card.title,
        type: isLine ? "line" : "bar",
        smooth: isLine,
        showSymbol: isLine,
        barMaxWidth: 36,
        data: values,
        itemStyle: {
          color: primary,
          // 柱状圆角（折线不适用，走线宽与面积表达）
          ...(isLine ? {} : { borderRadius: [6, 6, 0, 0] })
        },
        lineStyle: { width: 2, color: primary },
        // 折线配面积渐变（主色 24% → 透明），大屏与看板上更有层次
        ...(isLine
          ? {
              areaStyle: {
                color: {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: withAlpha(primary, 0.24) },
                    { offset: 1, color: withAlpha(primary, 0) }
                  ]
                }
              }
            }
          : {})
      }
    ]
  };
};

const loadData = async () => {
  const card = props.card;
  loading.value = true;
  errorMsg.value = "";
  try {
    if (card.chart_type === "number") {
      const res = await datasetApi.execute(card.dataset);
      if (res.code === SUCCESS_CODE) {
        total.value = Number(
          (res.data as unknown as ExecuteResult)?.total ?? 0
        );
        return;
      }
      errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
      return;
    }
    const res = await datasetApi.aggregate(card.dataset, {
      group_by: card.group_by,
      metric: card.metric ?? "count",
      date_trunc:
        card.chart_type === "line" ? (card.date_trunc ?? "day") : undefined,
      value_field: card.value_field
    });
    if (res.code === SUCCESS_CODE) {
      const result = res.data as unknown as AggregateResult;
      if (await waitSized()) {
        // 尺寸可能因卡片高度/宽度配置变化而与上次渲染不同，先重算再 set
        resize();
        setOptions(buildSeriesOptions(result));
      }
      return;
    }
    // 200 + 业务码非 1000（字段权限/数值字段校验等）：显式提示，避免图表空白无解释
    errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
  } catch (error) {
    errorMsg.value = String(
      (error as { detail?: string })?.detail ??
        error ??
        t("dashboard.loadFailed")
    );
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await nextTick();
  await loadData();
});

watch(
  () => props.card,
  () => loadData(),
  { deep: true }
);

/**
 * 图片导出：返回可下载图片（PNG 优先，转换失败回退 SVG）；
 * number 卡（无 ECharts 实例）返回 null，由调用方跳过并提示。
 */
async function renderImage(): Promise<ExportedImage | null> {
  const { renderEchartsImage } = await import("@/utils/imageExport");
  return renderEchartsImage(getInstance() as EChartsLike | null, {
    pixelRatio: 2,
    // 透明底在深色面板/暗色主题下不可读，取当前主题底色（EP 变量已按暗色重定义）
    backgroundColor: cssVarColor("--el-bg-color-overlay", "#ffffff")
  });
}

defineExpose({ loadData, renderImage });
</script>

<template>
  <div class="relative size-full">
    <div
      v-if="errorMsg"
      class="flex-c size-full flex-col gap-2 text-center"
      data-testid="chart-card-error"
    >
      <span class="text-xs text-(--el-color-danger)">{{ errorMsg }}</span>
      <el-button link type="primary" size="small" @click="loadData">
        {{ t("dashboard.retry") }}
      </el-button>
    </div>
    <template v-else>
      <div v-show="card.chart_type === 'number'" class="flex-c size-full">
        <span class="text-3xl font-semibold">{{ total }}</span>
      </div>
      <div
        v-show="card.chart_type !== 'number'"
        ref="chartRef"
        class="size-full"
      />
      <!-- 加载骨架：以覆盖层呈现（内容保留在 DOM，保证 waitSized 能测到容器尺寸） -->
      <div
        v-if="loading"
        class="chart-card-skeleton absolute inset-0"
        data-testid="chart-card-skeleton"
      >
        <ReSkeleton
          :rows="2"
          :variant="card.chart_type === 'number' ? 'text' : 'fill'"
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* 覆盖层需不透明底色（挡住加载中的旧数据/零值），取 EP 卡片底色变量 */
.chart-card-skeleton {
  padding: 16px;
  background: var(--el-card-bg-color, var(--el-bg-color-overlay));
}
</style>
