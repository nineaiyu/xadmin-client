import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import { useI18n } from "@/plugins/i18n";
import { getPlatformConfig } from "./config";
import { createApp, type Directive } from "vue";
import { MotionPlugin } from "@vueuse/motion";
import { useElementPlus } from "@/plugins/elementPlus";
import { useEcharts } from "@/plugins/echarts";
import { injectResponsiveStorage } from "@/utils/responsive";

import Table from "@pureadmin/table";
// import PureDescriptions from "@pureadmin/descriptions";
// 引入重置样式
import "./style/reset.scss";
// 导入公共样式
import "./style/index.scss";
// 一定要在main.ts中导入tailwind.css，防止vite每次hmr都会请求src/style/index.scss整体css文件导致热更新慢的问题
import "./style/tailwind.css";
import "element-plus/dist/index.css";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

// import { addPreventDefault } from "@/utils/preventDefault";
// 自定义指令
import * as directives from "@/directives";
// 全局注册`@iconify/vue`图标库
import {
  FontIcon,
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/ReIcon";
// 全局注册按钮级别权限组件
import { Auth } from "@/components/ReAuth";
// 全局注册`vue-tippy`
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/perspective.css";
import VueTippy from "vue-tippy";

const app = createApp(App);

Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);
app.component("FontIcon", FontIcon);

app.component("Auth", Auth);

app.use(VueTippy, {
  defaultProps: { animation: "perspective" }
});

// addPreventDefault();

getPlatformConfig(app).then(async config => {
  setupStore(app);
  app.use(router);
  await router.isReady();
  injectResponsiveStorage(app, config);
  app
    .use(MotionPlugin)
    .use(useI18n)
    .use(useElementPlus)
    .use(useEcharts)
    .use(Table);
  // .use(PureDescriptions);
  app.mount("#app");
});
