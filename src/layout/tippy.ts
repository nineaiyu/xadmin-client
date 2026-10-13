// 样式随注册模块加载（tippy 的默认主题 + 浅色主题）
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import TippyPlugin from "vue-tippy";
import type { App } from "vue";

/**
 * vue-tippy 全局注册（自应用入口下移到布局层）。
 *
 * `v-tippy` 的消费点全部位于布局树内（侧栏折叠按钮 / 设置面板提示 / 表格栏按钮），
 * 在 `main.ts` 注册会把 tippy 引擎与两套主题样式一并拖进首屏闭包
 * （见 `scripts/check-entry-closure.mjs` 的入口白名单）。布局是路由懒加载模块，
 * 注册与样式随布局分块加载即可——登录页等不渲染布局的入口不再为此付费。
 *
 * 保留全局注册：模块级 directives 覆盖不到 JSX 里的 `v-tippy`
 * （如表格栏 `RePureTableBar/src/bar.tsx` 走 `resolveDirective` 解析）。
 */
export function setupTippy(app: App) {
  app.use(TippyPlugin);
}
