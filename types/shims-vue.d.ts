declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "*.scss" {
  const scss: Record<string, string>;
  export default scss;
}

// vite-svg-loader / `?component` 查询：SVG 以 Vue 组件形态导入
// 用 DefineComponent（而非宽泛的 Component）：tsx 中可作为 JSX 元素渲染
declare module "*.svg?component" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export default component;
}

declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare module "*.svg?url" {
  const url: string;
  export default url;
}

declare module "vue-virtual-scroller";
