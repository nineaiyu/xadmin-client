<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import { cssVarColor, epColor } from "@/utils/chartTheme";

const { isDark } = useDark();

const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 占位环：趋势数据不足一行时的兜底图形，配色同样走主题 */
const applyOptions = () => {
  const color = epColor("primary");
  setOptions({
    container: ".line-card",
    title: {
      text: "100%",
      left: "47%",
      top: "30%",
      textAlign: "center",
      textStyle: {
        fontSize: "16",
        fontWeight: 600
      }
    },
    polar: {
      radius: ["100%", "90%"],
      center: ["50%", "50%"]
    },
    angleAxis: {
      max: 100,
      show: false
    },
    radiusAxis: {
      type: "category",
      show: true,
      axisLabel: {
        show: false
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      }
    },
    series: [
      {
        type: "bar",
        roundCap: true,
        barWidth: 2,
        showBackground: true,
        backgroundStyle: {
          color: cssVarColor("--el-fill-color", "#dfe7ef")
        },
        data: [100],
        coordinateSystem: "polar",
        color: color,
        itemStyle: {
          shadowBlur: 2,
          shadowColor: color,
          shadowOffsetX: 0,
          shadowOffsetY: 0
        }
      }
    ]
  });
};

applyOptions();
watch(isDark, applyOptions);
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 60px" />
</template>
