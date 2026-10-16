import { defineAsyncComponent } from "vue";

import { loadEcharts } from "@/plugins/echarts";

/**
 * `ChartCard` 的「echarts 就绪后再挂载」包装。
 *
 * `ChartCard` 在 setup 期同步调用 `@pureadmin/utils` 的 `useECharts`，而该 hook
 * 初始化时就读取全局 `$echarts`——组件挂载时引擎还没就绪的话，图表实例拿不到
 * echarts（表现为卡片空渲染，且不会自愈）。因此它不能在「引擎未就绪」时挂载。
 *
 * 入口侧已移除 echarts 的空闲预热（见 `plugins/echarts.ts`）：改为由消费方门控。
 * 仪表盘 / 大屏展示 / 看板设计器 / 报表设计器统一使用本包装，不要直接 import
 * `ChartCard.vue`——直接挂载会回到「依赖预热竞态」的旧形态。
 */
export const ChartCardAsync = defineAsyncComponent(async () => {
  await loadEcharts();
  return (await import("./ChartCard.vue")).default;
});
