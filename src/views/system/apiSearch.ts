/**
 * 注册元数据驱动的 `api-search-*` 远程搜索组件。
 *
 * 框架层（RePlusPage/src/utils/columns.tsx）只按名取用，业务侧在应用启动时
 * （main.ts）注册，避免通用组件反向依赖业务组件。
 *
 * 组件本体是统一的 SearchPicker（实体差异在组件内 PRESETS），此处按既有
 * `api-search-*` 契约名逐一注册；异步组件保持按需加载：只有页面真正用到
 * 对应 input_type 时才加载该组件。
 */
import { defineAsyncComponent } from "vue";
// 只取注册器（子路径导入）：若从 `@/components/RePlusPage` 桶导入，会把 RePlusPage
// 组件与它的重依赖（plus-pro、element-plus 页面级组件）静态拉进入口模块图，
// 使按需分块失去意义（实测首屏闭包因此多出整块 element-plus）
import { registerApiSearchComponents } from "@/components/RePlusPage/src/utils/apiSearch";
import { registerSuggestFetcher } from "@/components/RePlusPage/src/utils/suggest";
import { http } from "@/utils/http";

/** 远程联想fetcher：统一走 axios 拦截器（token / 业务码归一） */
registerSuggestFetcher((url, params) => http.request("get", url, { params }));

const pickerLoader = (entity: "user" | "dept" | "role" | "post" | "menu") =>
  defineAsyncComponent(() =>
    import("@/components/SearchPicker").then(m => m.createSearchPicker(entity))
  );

registerApiSearchComponents({
  "api-search-user": pickerLoader("user"),
  "api-search-dept": pickerLoader("dept"),
  "api-search-role": pickerLoader("role"),
  "api-search-post": pickerLoader("post"),
  "api-search-menu": pickerLoader("menu")
});
