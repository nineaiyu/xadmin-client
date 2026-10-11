import type { App } from "vue";
import { chartTextTheme } from "@/utils/chartTheme";

let echartsPromise: Promise<typeof import("echarts/core")> | null = null;
/** 首个传入的 app 引用：无论哪一次调用先触发加载，都能把 $echarts 挂到全局属性 */
let echartsApp: App | null = null;

/**
 * 按需异步加载 echarts 并挂到全局属性（约 180KB gzip，仅图表页面消费）。
 * 页面侧（welcome / monitor / 文件统计）会自行 `await loadEcharts()` 后再渲染图表。
 */
export function loadEcharts(app?: App) {
  if (app) echartsApp = app;
  echartsPromise ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/renderers"),
    import("echarts/components")
  ]).then(([core, charts, renderers, components]) => {
    core.use([
      charts.LineChart,
      charts.BarChart,
      charts.PieChart,
      renderers.SVGRenderer,
      components.GridComponent,
      components.TitleComponent,
      components.TooltipComponent,
      components.DataZoomComponent,
      components.LegendComponent
    ]);
    // 图表文字字体栈：zrender 把 font-family 写为行内样式，外部 CSS 覆盖不到，
    // 随主题名（页面统一传 theme: "light" | "dark"）在 init 层注入应用字体栈。
    // 若将来引入 ECharts 内置 dark 主题，需把其色板与字体栈合并后一并注册。
    const textTheme = chartTextTheme();
    core.registerTheme("light", textTheme);
    core.registerTheme("dark", textTheme);
    if (echartsApp) {
      // @pureadmin/utils 的 useECharts 在 hook 初始化时同步读取 $echarts，
      // 消费方须在 echartsReady 后渲染，见 welcome/index.vue
      echartsApp.config.globalProperties.$echarts = core;
    }
    return core;
  });
  return echartsPromise;
}

/**
 * Vue 插件：只记住 app 引用，**不做任何预热**。
 *
 * `load` 后的空闲预热对图表页没有提前量（页面挂载即调 `loadEcharts()`，共用同一个
 * promise），却会让「不图表」的页面在后台多拉约 1MB（raw）——首屏画像实测
 * system-user 页的 Script 传输量因此高出 21%（docs/perf-firstscreen.md）。
 * 因此按「谁用谁加载」：图表消费方自行 `await loadEcharts()` 或经
 * `views/dashboard/components/ChartCardAsync` 的门控包装挂载。
 */
export function useEcharts(app: App) {
  echartsApp = app;
}
