// 样式顺序即层叠顺序，改动前先读注释：
// reset → 公共样式 → tailwind → element-plus 按需样式（随 @/plugins/elementPlus 引入）
// → plus-pro-components → 应用外观层（appearance.scss，覆写 EP 组件视觉细节，必须最后）
import "./style/reset.scss";
import "./style/index.scss";
// 一定要在main.ts中导入tailwind.css，防止vite每次hmr都会请求src/style/index.scss整体css文件导致热更新慢的问题
import "./style/tailwind.css";

import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import { ensureLocale, useI18n } from "@/plugins/i18n";
import { responsiveStorageNameSpace } from "@/config";
import { storageLocal } from "@pureadmin/utils";
import { getPlatformConfig } from "./config";
import {
  capturePlatformDefaults,
  resolveBootLocale,
  resolveSiteTitle
} from "@/utils/preferences";
import { MotionPlugin } from "@vueuse/motion";
import { useEcharts } from "@/plugins/echarts";
import { createApp, defineAsyncComponent, type Directive } from "vue";
// 注册 `api-search-*` 元数据搜索组件（框架层不反向依赖业务页面，改由业务侧注入）
import "@/views/system/apiSearch";
import { useElementPlus } from "@/plugins/elementPlus";
import { usePlusProComponents } from "@/plugins/plusProComponents";
import { injectResponsiveStorage } from "@/utils/responsive";
import { initPlatform } from "@/utils/platform";

// 导入plus-pro-components 及其样式
import "plus-pro-components/index.css";
// 应用外观层（卡片圆角/层次/微交互）：必须排在 element-plus 样式之后才能覆写其组件规则
import "./style/appearance.scss";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

// 平台标记（写入 html[data-platform]）：滚动条等平台差异化样式依赖它，须在挂载前执行
initPlatform();

const app = createApp(App);

// 自定义指令
import * as directives from "@/directives";
Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

// 全局注册图标库（离线：不做在线图标 API 兜底，见 components/ReIcon/src/iconRegistry.ts）
import { FontIcon, IconifyIconOffline } from "./components/ReIcon";

app.component("IconifyIconOffline", IconifyIconOffline);
app.component("FontIcon", FontIcon);

// 全局注册按钮级别权限组件
import { Auth } from "@/components/ReAuth";
app.component("Auth", Auth);
// RePlusPage 是业务页面组件（登录/外壳不需要），全局注册为异步组件：
// 模板中的 <RePlusPage> 仍按同名解析，但组件代码与它独有的依赖（表格栈等）
// 不再进入首屏闭包，首次进入列表页时按需加载（见 docs/perf-firstscreen.md）
app.component(
  "RePlusPage",
  defineAsyncComponent(() =>
    import("@/components/RePlusPage").then(m => m.RePlusPage)
  )
);

import { getToken } from "@/utils/auth";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";

// WebSocket 重连前无感刷新 token：由入口注入刷新器（utils 层不直连 api 层）。
// 延迟注入：WS 客户端仅在登录后建连时才需要，静态导入会把 WS 客户端与 http
// 层一并拖进首屏闭包（见 scripts/check-entry-closure.mjs 的入口白名单）。
void Promise.all([
  import("@/utils/websocket"),
  import("@/utils/http/accessToken")
]).then(([ws, token]) => {
  ws.setReconnectTokenProvider(token.getUsedAccessToken);
});

getPlatformConfig(app).then(async config => {
  injectResponsiveStorage(app, config);
  // 平台出厂默认值快照：必须在下面的站点配置同步之前捕获——
  // getSiteConfig 会把服务端站点配置合并进全局 $config，之后 getConfig() 不再等于
  // platform-config.json（「恢复站点默认」依赖这份快照）
  capturePlatformDefaults();
  setupStore(app);
  // index.html 是静态产物（构建期不知道运行时标题），装配后回填：初始 title
  // 占位在首次路由跳转前与 platform-config 的 Title 保持一致
  const siteTitle = resolveSiteTitle();
  if (siteTitle) document.title = siteTitle;
  if (getToken()) {
    try {
      await useSiteConfigStoreHook().getSiteConfig();
    } catch (error) {
      console.warn("Failed to fetch site config, using default config:", error);
    }
  }
  /**
   * 实际生效的初始语言（html.lang 也按它回填，影响无障碍：屏幕阅读器发音 /
   * 浏览器翻译判定）。必须在站点配置同步之后判定——服务端 Locale 会经
   * `getSiteConfig` 覆写本地语言存储（而 i18n 实例的 locale 仍是创建时的值），
   * 布局 / 登录页随后按存储值恢复语言。若此处沿用同步前的值，en 语料不会被
   * 预加载，首帧就会报 "Not found 'xxx' key in 'en' locale messages" 并回退中文。
   */
  const appliedLocale = resolveBootLocale(
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}locale`
    )?.locale,
    config?.Locale
  );
  document.documentElement.lang =
    appliedLocale === "zh" ? "zh-CN" : appliedLocale;
  app.use(router);
  await router.isReady();
  // @pureadmin/table 不在此全局注册：唯一消费方 RePlusPage 内部按需 import
  // （<pure-table> 由该文件的局部 import 解析），避免表格栈进入首屏闭包
  app
    .use(MotionPlugin)
    .use(useI18n)
    .use(useElementPlus)
    .use(usePlusProComponents)
    .use(useEcharts);
  // 初始语言按需加载语言包（en 不随首屏闭包；zh 为 eager，无额外开销）：
  // 传「实际生效语言」，避免首帧出现 locale 已是 en 而语料未就绪的空窗
  await ensureLocale(appliedLocale);
  app.mount("#app");
});
