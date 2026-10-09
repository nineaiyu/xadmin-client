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
import { MotionPlugin } from "@vueuse/motion";
import { useEcharts } from "@/plugins/echarts";
import { createApp, defineAsyncComponent, type Directive } from "vue";
// 注册 `api-search-*` 元数据搜索组件（框架层不反向依赖业务页面，改由业务侧注入）
import "@/views/system/apiSearch";
import { useElementPlus } from "@/plugins/elementPlus";
import { usePlusProComponents } from "@/plugins/plusProComponents";
import { injectResponsiveStorage } from "@/utils/responsive";

// 导入plus-pro-components 及其样式
import "plus-pro-components/index.css";
// 应用外观层（卡片圆角/层次/微交互）：必须排在 element-plus 样式之后才能覆写其组件规则
import "./style/appearance.scss";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

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

// 全局注册vue-tippy
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import VueTippy from "vue-tippy";
import { getToken } from "@/utils/auth";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
app.use(VueTippy);

// WebSocket 重连前无感刷新 token：由入口注入刷新器（utils 层不直连 api 层）
import { setReconnectTokenProvider } from "@/utils/websocket";
import { getUsedAccessToken } from "@/utils/http/accessToken";
setReconnectTokenProvider(getUsedAccessToken);

getPlatformConfig(app).then(async config => {
  injectResponsiveStorage(app, config);
  setupStore(app);
  // index.html 是静态产物（构建期不知道运行时语言与平台标题），装配后回填：
  // html.lang 影响无障碍（屏幕阅读器发音/浏览器翻译判定），初始 title 占位
  // 在首次路由跳转前与 platform-config 的 Title 保持一致
  const initialLocale =
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}locale`
    )?.locale ?? "zh";
  document.documentElement.lang =
    initialLocale === "zh" ? "zh-CN" : initialLocale;
  if (config?.Title) document.title = String(config.Title);
  if (getToken()) {
    try {
      await useSiteConfigStoreHook().getSiteConfig();
    } catch (error) {
      console.warn("Failed to fetch site config, using default config:", error);
    }
  }
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
  // 初始语言为 en 时按需加载语言包（en 不随首屏闭包；zh 为 eager，无额外开销）
  await ensureLocale();
  app.mount("#app");
});
