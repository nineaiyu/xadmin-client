/**
 * 注册元数据驱动的 `api-search-*` 远程搜索组件。
 *
 * 这些组件原先由框架层（`RePlusPage/src/utils/columns.tsx`）直接 import，
 * 使通用组件反向依赖业务页面：业务组件被拖进主包，且存在循环依赖风险。
 * 现由业务侧在应用启动时（`main.ts`）注册，框架只按名取用。
 *
 * 采用异步组件保持按需加载：只有页面真正用到对应 `input_type` 时才加载该组件。
 */
import { defineAsyncComponent } from "vue";
import { registerApiSearchComponents } from "@/components/RePlusPage";

registerApiSearchComponents({
  "api-search-user": defineAsyncComponent(
    () => import("./components/SearchUser.vue")
  ),
  "api-search-dept": defineAsyncComponent(
    () => import("./components/SearchDept.vue")
  ),
  "api-search-role": defineAsyncComponent(
    () => import("./components/SearchRole.vue")
  ),
  "api-search-menu": defineAsyncComponent(
    () => import("./components/SearchMenu.vue")
  )
});
