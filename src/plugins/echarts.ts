import type { App } from "vue";
import { chartFontFamily, chartTextTheme } from "@/utils/chartTheme";

/** 偏好写入后主题重注册的合并窗口（设置面板连续改动只重注册一次） */
const THEME_REFRESH_DEBOUNCE_MS = 200;

/** 同标签偏好变更事件（站点配置 store 保存/同步后派发） */
export const CHART_THEME_PREFERENCE_EVENT = "xadmin:preference-changed";

let echartsPromise: Promise<typeof import("echarts/core")> | null = null;
/** 首个传入的 app 引用：无论哪一次调用先触发加载，都能把 $echarts 挂到全局属性 */
let echartsApp: App | null = null;
/** 已加载的 echarts 入口：主题重注册复用同一实例；加载失败保持 null */
let loadedCore: typeof import("echarts/core") | null = null;
/** 最近一次注册的字体栈：相同值不重复注册（去重） */
let registeredFontFamily = "";
let themeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let stopPreferenceWatch: (() => void) | null = null;

/**
 * 注册 `light` / `dark` 两个主题名的字体栈。
 *
 * zrender 把 font-family 写为行内样式，外部 CSS 覆盖不到，只能在 init 主题层注入；
 * 运行期字体偏好变化后需重新注册，后续 init 的图表才会拿到新字体。
 * 字体栈未变时直接跳过（同一份偏好连续写入不产生重复注册）。
 */
function registerChartThemes(core: typeof import("echarts/core")): void {
  const family = chartFontFamily();
  if (family === registeredFontFamily) return;
  registeredFontFamily = family;
  const theme = chartTextTheme();
  core.registerTheme("light", theme);
  core.registerTheme("dark", theme);
}

/** 合并窗口内只重注册一次（去重防抖）；未加载或字体栈未变时不注册 */
export function scheduleChartThemeRefresh(
  delay = THEME_REFRESH_DEBOUNCE_MS
): void {
  if (!loadedCore) return;
  if (themeRefreshTimer) clearTimeout(themeRefreshTimer);
  themeRefreshTimer = setTimeout(() => {
    themeRefreshTimer = null;
    if (loadedCore) registerChartThemes(loadedCore);
  }, delay);
}

/** 立即重注册（供已加载场景的显式刷新；字体栈未变时为空操作） */
export function refreshChartTheme(): void {
  if (loadedCore) registerChartThemes(loadedCore);
}

/**
 * 监听偏好变化并安排主题重注册。
 *
 * - 同标签：站点配置 store 在偏好落库/同步后派发 `xadmin:preference-changed`；
 * - 跨标签：响应式存储写入会触发 `storage` 事件（layout / configure 命名空间）。
 */
function watchPreferenceChanges(): void {
  if (stopPreferenceWatch || typeof window === "undefined") return;
  const onStorage = (event: StorageEvent) => {
    const key = event.key ?? "";
    if (!key.endsWith("-layout") && !key.endsWith("-configure")) return;
    scheduleChartThemeRefresh();
  };
  const onPreference = () => scheduleChartThemeRefresh();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHART_THEME_PREFERENCE_EVENT, onPreference);
  stopPreferenceWatch = () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHART_THEME_PREFERENCE_EVENT, onPreference);
    stopPreferenceWatch = null;
  };
}

/** 停止监听与挂起的重注册（卸载 / 测试清理用） */
export function stopChartThemeWatch(): void {
  stopPreferenceWatch?.();
  if (themeRefreshTimer) {
    clearTimeout(themeRefreshTimer);
    themeRefreshTimer = null;
  }
}

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
  ])
    .then(([core, charts, renderers, components]) => {
      core.use([
        charts.LineChart,
        charts.BarChart,
        charts.PieChart,
        renderers.SVGRenderer,
        components.GridComponent,
        components.TitleComponent,
        components.TooltipComponent,
        components.DataZoomComponent,
        components.LegendComponent,
        // 极坐标系：工作台「趋势数据不足」的环形占位图（ChartRound）用 polar + bar 绘制
        components.PolarComponent
      ]);
      // 图表文字字体栈随站点字体偏好注册；偏好变化经 watchPreferenceChanges 重新注册
      loadedCore = core;
      registerChartThemes(core);
      watchPreferenceChanges();
      if (echartsApp) {
        // @pureadmin/utils 的 useECharts 在 hook 初始化时同步读取 $echarts，
        // 消费方须在 echartsReady 后渲染，见 welcome/index.vue
        echartsApp.config.globalProperties.$echarts = core;
      }
      return core;
    })
    .catch(error => {
      // 分包加载失败不能永久缓存 rejected promise：清空后允许下次调用重试
      echartsPromise = null;
      loadedCore = null;
      throw error;
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
