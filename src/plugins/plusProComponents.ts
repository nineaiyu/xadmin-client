// 按需引入plus-pro-components（该方法稳定且明确。当然也支持：https://plus-pro-components.github.io/guide/quickstart.html#%E8%87%AA%E5%8A%A8%E6%8C%89%E9%9C%80%E5%AF%BC%E5%85%A5-%E6%8E%A8%E8%8D%90）
import type { App, Component } from "vue";
import {
  PlusDescriptions,
  PlusDialogForm,
  PlusDrawerForm,
  PlusForm,
  PlusLayout,
  PlusPage,
  PlusSearch,
  PlusTable
} from "plus-pro-components";

const components = [
  PlusLayout,
  PlusPage,
  PlusTable,
  PlusSearch,
  PlusForm,
  PlusDialogForm,
  PlusDrawerForm,
  PlusDescriptions
];
const plugins = [];

/** 按需引入`plus-pro-components` */
export function usePlusProComponents(app: App) {
  // 全局注册组件
  components.forEach((component: Component) => {
    app.component(component.name, component);
  });
  // 全局注册插件
  plugins.forEach(plugin => {
    app.use(plugin);
  });
}
