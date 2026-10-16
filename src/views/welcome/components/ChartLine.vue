<script lang="ts" setup>
import { computed, type PropType, ref, watch } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import { epColor } from "@/utils/chartTheme";

const props = defineProps({
  data: {
    type: Array as PropType<Array<number>>,
    default: () => []
  },
  /** 趋势线颜色；留空取主题主色（跟随自定义主题色/暗色模式） */
  color: {
    type: String,
    default: ""
  }
});

const { isDark } = useDark();

const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, {
  theme,
  renderer: "svg"
});

/** 折线：颜色在调用时解析（主题切换后重设即跟随） */
const applyOptions = () => {
  const color = props.color || epColor("primary");
  setOptions({
    container: ".line-card",
    xAxis: {
      type: "category",
      show: false,
      data: props.data
    },
    grid: {
      top: "15px",
      bottom: 0,
      left: 0,
      right: 0
    },
    yAxis: {
      show: false,
      type: "value"
    },
    series: [
      {
        data: props.data,
        type: "line",
        symbol: "none",
        smooth: true,
        color: color,
        lineStyle: {
          shadowOffsetY: 3,
          shadowBlur: 7,
          shadowColor: color
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
