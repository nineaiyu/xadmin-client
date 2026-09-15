/**
 * `@wangeditor/editor-for-vue` 官方包未随包发布类型声明（dist 为纯 JS），
 * 这里补最小声明：仅覆盖本项目消费的两个组件（Editor / Toolbar）。
 * 编辑器的配置与实例类型由自带类型的 `@wangeditor/editor` 提供。
 */
declare module "@wangeditor/editor-for-vue" {
  import type { DefineComponent } from "vue";

  export const Editor: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
  export const Toolbar: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >;
}
