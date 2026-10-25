<script lang="ts" setup>
import { isSuccess } from "@/api/types";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ReSkeleton from "@/components/ReSkeleton";
import { useDark, useECharts } from "@pureadmin/utils";
import type { UtilsEChartsOption } from "@pureadmin/utils";
import { usePageLoading } from "@/hooks/usePageLoading";
import {
  datasetApi,
  type AggregateResult,
  type DashboardCard,
  type ExecuteResult
} from "@/api/dataset/datasets";
import {
  CHART_ACCENT,
  chartColorScheme,
  chartLightColorScheme,
  epColor,
  withAlpha
} from "@/utils/chartTheme";
import { waitChartSized } from "@/utils/chart";
// 仅类型引用（不进包）：导出实现按需动态加载（保持首屏体积）
import type { EChartsLike, ExportedImage } from "@/utils/imageExport";

defineOptions({ name: "DashboardChartCard" });

const props = defineProps<{
  card: DashboardCard;
  /** 刷新信号：父组件自增令牌触发原位重拉（不销毁重建实例）；首拉仍走 onMounted */
  refreshToken?: number;
  /**
   * 强制深色图表：深色主题大屏 / 投屏用，不跟随站点主题。
   * 站点为亮色时也按深色基线渲染，避免深色画布上出现白底黑字的图表。
   */
  forceDark?: boolean;
  /**
   * 强制浅色图表：浅色主题大屏用（站点可能为暗色，EP 变量取到的是深底浅字）。
   * 优先级 forceDark > forceLight > 跟随站点；配色走固定浅色基线。
   */
  forceLight?: boolean;
  /**
   * 图表可下钻：点击图形元素向上派发 drill 事件（携带点击维度值），由父级
   * 打开明细抽屉。默认关闭（大屏/投屏展示场景不接下钻）。
   */
  drillable?: boolean;
  /**
   * 卡片联动过滤（父级按数据集字段能力判定后下发）：非空时本次取数带
   * 请求级 filters（与数据集定义 filters 叠加，服务端 validate_filters 再校验）。
   * 刷新仍走 refreshToken 令牌，本组件不自行监听该 prop。
   */
  linkageFilter?: { field: string; value: unknown } | null;
}>();

const emit = defineEmits<{
  /** 点亮图形元素（drillable 时）：point 为点击的维度项；null = 全量 */
  drill: [point: { name: string; raw?: unknown } | null];
}>();

const { t } = useI18n();
const { isDark } = useDark();
const dark = computed(
  () => Boolean(props.forceDark) || (!props.forceLight && isDark.value)
);
const theme = computed(() => (dark.value ? "dark" : "light"));
/** 取色作用域：卡片自身（大屏根节点内联覆写的主色对后代可见） */
const rootRef = ref<HTMLElement>();
const colorScope = computed(() => rootRef.value ?? null);

const chartRef = ref();
const { loading, runWithLoading } = usePageLoading();
const total = ref(0);
/** 数据加载请求序号：竞态防护（自动刷新 / 手动刷新 / 草稿变动并发时丢弃过期响应） */
let loadSeq = 0;
/** 加载失败原因：图表/数字区域改为可读提示 + 重试（业务码非 1000 与网络异常统一收敛） */
const errorMsg = ref("");
/** 解构 resize：容器尺寸（卡片高度/宽度档位）变化后手动重算，window resize 监听不覆盖容器变化 */
const { setOptions, resize, getInstance } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 分类色板：EP 语义色跟随主题（第 6 色为图表专用强调色，集中定义于 chartTheme）；调用时读取 */
const palette = () => [
  epColor("primary", colorScope.value),
  epColor("success", colorScope.value),
  epColor("warning", colorScope.value),
  epColor("danger", colorScope.value),
  epColor("info", colorScope.value),
  CHART_ACCENT
];

/** 配色方案：强制浅色走固定浅色基线（站点暗色时也不被污染） */
const schemeOf = () =>
  props.forceLight && !props.forceDark
    ? chartLightColorScheme()
    : chartColorScheme(dark.value, colorScope.value);

/** 联动过滤载荷：请求级 filters（字段能力判定在父级，服务端 validate_filters 兜底） */
const activeFilters = computed(() =>
  props.linkageFilter
    ? [
        {
          field: props.linkageFilter.field,
          op: "exact",
          value: props.linkageFilter.value
        }
      ]
    : undefined
);

const buildSeriesOptions = (result: AggregateResult): UtilsEChartsOption => {
  const names = result.series.map(item => item.name);
  const values = result.series.map(item => Number(item.value ?? 0));
  // tooltip / 坐标轴 / 图例统一取配色方案：亮色跟随 EP 变量，暗色与恒深色大屏
  // 用固定深色基线（站点亮色时 EP 变量仍是亮色，不能用于深色画布）
  const scheme = schemeOf();
  const tooltipStyle = {
    backgroundColor: scheme.tooltipBg,
    borderColor: scheme.tooltipBorder,
    textStyle: { color: scheme.text },
    axisPointer: { lineStyle: { color: scheme.textSecondary } }
  };
  const axisLabelStyle = { color: scheme.textSecondary };
  const axisLineStyle = { lineStyle: { color: scheme.axisLine } };
  if (props.card.chart_type === "pie") {
    const colors = palette();
    return {
      tooltip: { trigger: "item", ...tooltipStyle },
      legend: {
        bottom: 0,
        icon: "circle",
        textStyle: { color: scheme.textSecondary }
      },
      series: [
        {
          name: props.card.title,
          type: "pie",
          radius: ["38%", "62%"],
          // 扇区间留白 + 圆角：默认相邻扇区紧贴，深底上层次感不足
          itemStyle: {
            borderColor: scheme.pieBorder,
            borderWidth: 2,
            borderRadius: 4
          },
          // 标签与引导线显式取配色方案：默认文本色在深色底上不可读
          label: { color: scheme.textSecondary },
          labelLine: { lineStyle: { color: scheme.axisLine } },
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
    xAxis: {
      type: "category",
      boundaryGap: !isLine,
      data: names,
      axisLabel: axisLabelStyle,
      axisLine: axisLineStyle,
      axisTick: axisLineStyle
    },
    yAxis: {
      type: "value",
      axisLabel: axisLabelStyle,
      splitLine: { lineStyle: { color: scheme.splitLine } }
    },
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

/** 卡片加载：失败就地转骨架错误态（errorMsg），不外抛；loading 由 hook 托管 */
const loadData = () =>
  runWithLoading(async () => {
    const card = props.card;
    // 请求序号：自动刷新（10s 档）与手动刷新 / 编辑草稿变动竞态时，
    // 丢弃过期响应，防旧数据后到覆盖新数据或把已恢复的错误态又打成错误
    const seq = ++loadSeq;
    /** 本次请求是否仍是最新（过期响应直接丢弃，不触碰共享状态） */
    const fresh = () => seq === loadSeq;
    errorMsg.value = "";
    try {
      if (card.chart_type === "number") {
        // count_only：数字卡只读 total，服务端跳过全量行物化
        const res = await datasetApi.execute<ExecuteResult>(card.dataset, {
          count_only: true,
          filters: activeFilters.value
        });
        if (!fresh()) return;
        if (isSuccess(res)) {
          total.value = Number(res.data?.total ?? 0);
          return;
        }
        errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
        return;
      }
      if (card.chart_type === "metric") {
        // 指标卡：count = 行总数（复用 execute）；sum/avg = 无分组纯聚合单值
        if ((card.metric ?? "count") === "count") {
          const res = await datasetApi.execute<ExecuteResult>(card.dataset, {
            count_only: true,
            filters: activeFilters.value
          });
          if (!fresh()) return;
          if (isSuccess(res)) {
            total.value = Number(res.data?.total ?? 0);
            return;
          }
          errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
          return;
        }
        const res = await datasetApi.aggregate<AggregateResult>(card.dataset, {
          group_by: "",
          metric: card.metric ?? "count",
          value_field: card.value_field,
          filters: activeFilters.value
        });
        if (!fresh()) return;
        if (isSuccess(res)) {
          total.value = Number(res.data?.series?.[0]?.value ?? 0);
          return;
        }
        errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
        return;
      }
      const res = await datasetApi.aggregate<AggregateResult>(card.dataset, {
        group_by: card.group_by,
        metric: card.metric ?? "count",
        date_trunc:
          card.chart_type === "line" ? (card.date_trunc ?? "day") : undefined,
        value_field: card.value_field,
        filters: activeFilters.value
      });
      if (!fresh()) return;
      if (isSuccess(res)) {
        await renderAggregate(res.data);
        return;
      }
      // 200 + 业务码非 1000（字段权限/数值字段校验等）：显式提示，避免图表空白无解释
      errorMsg.value = String(res.detail ?? t("dashboard.loadFailed"));
    } catch (error) {
      if (!fresh()) return;
      errorMsg.value = String(
        (error as { detail?: string })?.detail ??
          error ??
          t("dashboard.loadFailed")
      );
    }
  });

/** 最近一次聚合序列（下钻点击时按维度名反查 raw 原始值） */
const lastSeries = ref<AggregateResult["series"]>([]);
let drillBound = false;

/**
 * 图表点击下钻：点击柱/扇区派发该维度项（name 为可读 label，raw 为过滤原值；
 * 趋势序列无 raw——派发后由父级回落为全量明细）。实例由 useECharts 延迟创建，
 * 首次渲染成功后挂载一次。
 */
function bindDrillClick() {
  if (drillBound || !props.drillable) return;
  const instance = getInstance();
  if (!instance || typeof instance.on !== "function") return;
  instance.on("click", (params: { name?: string }) => {
    if (!props.drillable || !params?.name) return;
    const hit = lastSeries.value.find(item => item.name === params.name);
    emit("drill", { name: params.name, raw: hit?.raw });
  });
  drillBound = true;
}

/** 渲染聚合数据（HTTP 拉取与 WS 注入共用同一渲染路径） */
const renderAggregate = async (result: AggregateResult) => {
  if (await waitChartSized(() => chartRef.value as HTMLElement | undefined)) {
    // 尺寸可能因卡片高度/宽度配置变化而与上次渲染不同，先重算再 set
    resize();
    setOptions(buildSeriesOptions(result));
    lastSeries.value = result.series;
    bindDrillClick();
  }
};

/**
 * 注入服务端聚合帧数据（screen_data），免拉直渲——投屏页 WS 推送通道用。
 * kind=execute 渲染指标数字；kind=aggregate 渲染图表；带 detail（服务端
 * 单卡失败进 errors，与 HTTP 业务码非 1000 同语义）时显示可读错误。
 * 数据非本卡时由调用方过滤，此处不做归属校验。
 */
const applyData = async (entry: {
  kind?: string;
  data?: unknown;
  detail?: string;
}) => {
  if (typeof entry?.detail === "string" && entry.detail) {
    errorMsg.value = entry.detail;
    return;
  }
  errorMsg.value = "";
  if (props.card.chart_type === "metric" && entry.kind === "aggregate") {
    // 服务端对 metric 卡统一走聚合（count 也是单桶 Total 帧），取首值渲染大数字
    total.value = Number(
      (entry.data as AggregateResult)?.series?.[0]?.value ?? 0
    );
    return;
  }
  if (entry.kind === "execute") {
    total.value = Number((entry.data as ExecuteResult)?.total ?? 0);
    return;
  }
  await renderAggregate(entry.data as AggregateResult);
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

/** 刷新信号：令牌变化即在原实例上重拉数据（手动刷新与自动刷新共用同一入口） */
watch(
  () => props.refreshToken,
  () => loadData()
);

/** 编辑态切换后补挂下钻（编辑期间不派发，退出编辑时实例已在） */
watch(
  () => props.drillable,
  value => {
    if (value) bindDrillClick();
  }
);

/**
 * 图片导出：返回可下载图片（PNG 优先，转换失败回退 SVG）；
 * number 卡（无 ECharts 实例）返回 null，由调用方跳过并提示。
 */
async function renderImage(): Promise<ExportedImage | null> {
  const { renderEchartsImage } = await import("@/utils/imageExport");
  return renderEchartsImage(getInstance() as EChartsLike | null, {
    pixelRatio: 2,
    // 透明底在深色面板/暗色主题下不可读：按当前配色方案取不透明底色
    backgroundColor: schemeOf().exportBg
  });
}

defineExpose({ loadData, applyData, renderImage });
</script>

<template>
  <div
    ref="rootRef"
    class="relative size-full"
    :class="{
      'chart-card--force-dark': forceDark,
      'chart-card--force-light': forceLight && !forceDark
    }"
    :data-chart-theme="dark ? 'dark' : 'light'"
  >
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
      <div
        v-show="card.chart_type === 'number' || card.chart_type === 'metric'"
        class="flex-c size-full"
      >
        <span class="text-3xl font-semibold">{{ total }}</span>
      </div>
      <div
        v-show="card.chart_type !== 'number' && card.chart_type !== 'metric'"
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
          :variant="
            card.chart_type === 'number' || card.chart_type === 'metric'
              ? 'text'
              : 'fill'
          "
        />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* 覆盖层需不透明底色（挡住加载中的旧数据/零值），取 EP 卡片底色变量 */
.chart-card-skeleton {
  padding: var(--space-4);
  background: var(--el-card-bg-color, var(--el-bg-color-overlay));
}

/* 恒深色大屏：骨架同步走深色，避免加载瞬间在深色卡片上闪白 */
.chart-card--force-dark .chart-card-skeleton {
  --el-fill-color-light: rgb(255 255 255 / 8%);

  background: #0b1220;
}

/* 浅色主题大屏：站点可能是暗色，骨架不能跟着变深（浅色卡片上会闪黑块），
   取大屏浅色档令牌（深色主题下这两支令牌本就是深色，不会误用） */
.chart-card--force-light .chart-card-skeleton {
  --el-fill-color-light: var(--screen-surface-strong);

  background: var(--screen-canvas-top);
}
</style>
