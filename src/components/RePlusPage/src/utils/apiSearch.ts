import type { Component } from "vue";

/**
 * `api-search-*` 自定义搜索组件注册表。
 *
 * 框架层原先直接 import `@/views/system/components/Search*.vue`：通用组件反向依赖
 * 业务页面，既把业务组件拖进主包，又存在循环依赖风险（同目录已因循环依赖刻意
 * 绕开 `@/utils/dict`）。现改为业务侧在应用启动时注册，框架只按名取用。
 *
 * 用法：`registerApiSearchComponent("api-search-user", SearchUser)`
 * （或 `registerApiSearchComponents({ ... })` 批量注册），需在页面首次渲染前完成。
 */
const apiSearchComponents: Record<string, Component> = {};

/** 注册（或覆盖）一个 `api-search-*` 搜索组件 */
export function registerApiSearchComponent(name: string, component: Component) {
  apiSearchComponents[name] = component;
}

/** 批量注册 `api-search-*` 搜索组件 */
export function registerApiSearchComponents(
  components: Record<string, Component>
) {
  Object.assign(apiSearchComponents, components);
}

/** 读取已注册的 `api-search-*` 搜索组件映射 */
export function getApiSearchComponents(): Record<string, Component> {
  return apiSearchComponents;
}

/**
 * 按名取用 `api-search-*` 搜索组件。
 *
 * 未注册时返回 undefined（`h(undefined)` 渲染为空节点，不会抛错），
 * 并在开发环境给出提示，避免"表单里字段静默消失"难以定位。
 */
export function getApiSearchComponent(name: string): Component {
  const component = apiSearchComponents[name];
  if (!component && import.meta.env.DEV) {
    console.warn(
      `[RePlusPage] 未注册 "${name}" 搜索组件，请在应用启动时调用 ` +
        `registerApiSearchComponent("${name}", ...) 完成注册`
    );
  }
  return component;
}
