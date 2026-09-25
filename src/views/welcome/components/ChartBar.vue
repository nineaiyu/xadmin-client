<script lang="ts" setup>
import { getKeyList, useDark, useECharts, useGlobal } from "@pureadmin/utils";
import { computed, nextTick, type PropType, ref, watch } from "vue";
import type { DashboardTrendItem } from "@/api/system/dashboard";
import { cssVarColor, epColor } from "@/utils/chartTheme";

const props = defineProps({
  // 行结构为 { day, count }（内部按字段取值渲染 x 轴与折线）
  showData: {
    type: Array as PropType<Array<DashboardTrendItem>>,
    default: () => []
  },
  title: {
    type: String,
    default: ""
  },
  // 语义变体（注册/登录）：决定折线配色。不能用中文标题做判断——
  // 英文环境下标题恒不等于"注册"，会永远落入登录配色分支
  variant: {
    type: String as PropType<"register" | "login">,
    default: "register"
  }
});

const { isDark } = useDark();

const theme = computed(() => (isDark.value ? "dark" : "light"));
const { $echarts } = useGlobal<GlobalPropertiesApi>();

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme
});

/** 配色取自 EP 语义色（跟随自定义主题色/暗色模式），调用时解析 */
const applyOptions = () => {
  const color = [epColor("primary"), epColor("success")][
    props.variant === "register" ? 0 : 1
  ];
  setOptions({
    container: ".bar-card",
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "none"
      }
    },
    grid: {
      top: "20px",
      left: "50px",
      right: 0
    },
    dataZoom: [
      {
        show: true,
        realtime: true,
        start: 50,
        end: 100,
        xAxisIndex: [0, 1]
      },
      {
        type: "inside",
        realtime: true,
        start: 50,
        end: 100,
        xAxisIndex: [0, 1]
      }
    ],
    xAxis: [
      {
        type: "category",
        data: getKeyList(props.showData, "day", false),
        axisLabel: {
          fontSize: "0.875rem"
        },
        axisPointer: {
          type: "shadow"
        }
      }
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: {
          fontSize: "0.875rem"
        },
        splitLine: {
          show: true // 去网格线
        }
        // name: "单位: 个"
      }
    ],
    series: [
      {
        // series 名直接用调用方传入的（已 i18n）标题：不再拼中文"人数"
        name: props.title,
        type: "line",
        smooth: true,
        symbolSize: 8,
        itemStyle: {
          color: color,
          borderRadius: [10, 10, 0, 0]
        },
        data: getKeyList(props.showData, "count", false),
        areaStyle: {
          shadowColor: color,
          shadowBlur: 10,
          opacity: 0.3,
          // 渐变尾端取主题底色：暗色下不再出现白色渐隐
          color: new $echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: color
            },
            {
              offset: 1,
              color: cssVarColor("--el-bg-color-overlay", "#ffffff")
            }
          ])
        }
      }
    ]
  });
};

watch(
  () => props,
  async () => {
    await nextTick(); // 确保DOM更新完成后再执行
    applyOptions();
  },
  {
    deep: true,
    immediate: true
  }
);

watch(isDark, applyOptions);
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 400px" />
</template>
