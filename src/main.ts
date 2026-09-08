// 样式顺序即层叠顺序，改动前先读注释：
// reset → 公共样式 → tailwind → element-plus 按需样式（随 @/plugins/elementPlus 引入）
// → plus-pro-components。把 element-plus 提到最前面会让 tailwind 工具类反过来覆盖组件样式
import "./style/reset.scss";
import "./style/index.scss";
// 一定要在main.ts中导入tailwind.css，防止vite每次hmr都会请求src/style/index.scss整体css文件导致热更新慢的问题
import "./style/tailwind.css";

import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import { useI18n } from "@/plugins/i18n";
import { getPlatformConfig } from "./config";
import { MotionPlugin } from "@vueuse/motion";
import { useEcharts } from "@/plugins/echarts";
import { createApp, type Directive } from "vue";
import { RePlusPage } from "@/components/RePlusPage";
import { useElementPlus } from "@/plugins/elementPlus";
import { usePlusProComponents } from "@/plugins/plusProComponents";
import { injectResponsiveStorage } from "@/utils/responsive";

import Table from "@pureadmin/table";

// 导入plus-pro-components 及其样式
import "plus-pro-components/index.css";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

const app = createApp(App);

// 自定义指令
import * as directives from "@/directives";
Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

// 全局注册@iconify/vue图标库
import {
  FontIcon,
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/ReIcon";

app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);
app.component("FontIcon", FontIcon);

// 全局注册按钮级别权限组件
import { Auth } from "@/components/ReAuth";
app.component("Auth", Auth);
app.component("RePlusPage", RePlusPage);

// 全局注册vue-tippy
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import VueTippy from "vue-tippy";
import { getToken } from "@/utils/auth";
import { useSiteConfigStoreHook } from "@/store/modules/siteConfig";
app.use(VueTippy);

getPlatformConfig(app).then(async config => {
  injectResponsiveStorage(app, config);
  setupStore(app);
  if (getToken()) {
    try {
      await useSiteConfigStoreHook().getSiteConfig();
    } catch (error) {
      console.warn("Failed to fetch site config, using default config:", error);
    }
  }
  app.use(router);
  await router.isReady();
  app
    .use(MotionPlugin)
    .use(useI18n)
    .use(useElementPlus)
    .use(usePlusProComponents)
    .use(Table)
    .use(useEcharts);
  app.mount("#app");
});
