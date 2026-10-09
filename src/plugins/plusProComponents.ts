// 按需引入 plus-pro-components（该方法稳定且明确。当然也支持：https://plus-pro-components.github.io/guide/quickstart.html#%E8%87%AA%E5%8A%A8%E6%8C%89%E9%9C%80%E5%AF%BC%E5%85%A5-%E6%8E%A8%E8%8D%90）
//
// 全局注册为异步组件：PlusSearch / PlusForm 只出现在业务列表页与表单页
// （主要消费方 RePlusPage 本身也已按需加载），应用外壳（布局 / 登录）不消费它们。
// 若静态注册，plus-pro 会从 element-plus 桶文件具名导入一整套 EP 组件
// （cascader / date-picker / color-picker / table / tree-select …），
// 把整块 element-plus 拖进首屏闭包——异步注册可让其随页面按需到达。
import { defineAsyncComponent, type App } from "vue";

/** 全局注册`plus-pro-components`（按需异步） */
export function usePlusProComponents(app: App) {
  app.component(
    "PlusSearch",
    defineAsyncComponent(() =>
      import("plus-pro-components").then(m => m.PlusSearch)
    )
  );
  app.component(
    "PlusForm",
    defineAsyncComponent(() =>
      import("plus-pro-components").then(m => m.PlusForm)
    )
  );
}
