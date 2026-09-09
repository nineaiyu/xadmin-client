import type { App } from "vue";

let echartsPromise: Promise<typeof import("echarts/core")> | null = null;

/** 按需异步加载 echarts 并挂到全局属性（首屏延迟约 180KB gzip，仅仪表盘图表消费） */
export function loadEcharts(app?: App) {
  echartsPromise ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/renderers"),
    import("echarts/components")
  ]).then(([core, charts, renderers, components]) => {
    core.use([
      charts.LineChart,
      renderers.SVGRenderer,
      components.GridComponent,
      components.TitleComponent,
      components.TooltipComponent,
      components.DataZoomComponent,
      components.LegendComponent
    ]);
    if (app) {
      // @pureadmin/utils 的 useECharts 在 hook 初始化时同步读取 $echarts，
      // 消费方（welcome 图表组件）须在 echartsReady 后渲染，见 welcome/index.vue
      app.config.globalProperties.$echarts = core;
    }
    return core;
  });
  return echartsPromise;
}

/** Vue 插件：启动即预热 echarts chunk（与登录页资源并行加载），不阻塞首屏挂载 */
export function useEcharts(app: App) {
  loadEcharts(app);
}
