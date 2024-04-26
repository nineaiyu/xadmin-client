<script lang="ts" setup>
import { getKeyList, useDark, useECharts, useGlobal } from "@pureadmin/utils";
import { computed, nextTick, type PropType, ref, watch } from "vue";

const props = defineProps({
  showData: {
    type: Array as PropType<Array<number>>,
    default: () => []
  },
  title: {
    type: String,
    default: ""
  }
});

const { isDark } = useDark();

const theme = computed(() => (isDark.value ? "dark" : "light"));
const { $echarts } = useGlobal<GlobalPropertiesApi>();
const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme
});
watch(
  () => props,
  async () => {
    await nextTick(); // 确保DOM更新完成后再执行
    const color = ["#41b6ff", "#26ce83"][props.title === "注册" ? 0 : 1];
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
          name: `${props.title}人数`,
          type: "line",
          smooth: true,
          symbolSize: 8,
          itemStyle: {
            color: color,
            borderRadius: [10, 10, 0, 0]
          },
          data: getKeyList(props.showData, "count", false),
          areaStyle: {
            shadowColor: "rgb(209,239,225)",
            shadowBlur: 10,
            opacity: 0.3,
            color: new $echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: color
              },
              {
                offset: 1,
                color: "rgb(255,255,255)"
              }
            ])
          }
        }
      ]
    });
  },
  {
    deep: true,
    immediate: true
  }
);
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 400px" />
</template>
