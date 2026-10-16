import reDialog from "./index.vue";
import { withInstall } from "@pureadmin/utils";

/**
 * 统一出口：组件注册 + 命令式 API 重导出。
 *
 * 命令式 API（store/addDialog/closeDialog…）在 `./store`，本文件不承载状态逻辑——
 * 组件（index.vue）与命令式 API 互相需要对方的符号，拆成两个模块可避免
 * `index.vue ↔ index.ts` 的顶层循环导入（环内顶层求值顺序随入口漂移）。
 *
 * 千万别忘了在下面这三处引入并注册下，放心注册，不使用`addDialog`调用就不会被挂载
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L4
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L12
 * https://github.com/pure-admin/vue-pure-admin/blob/main/src/App.vue#L22
 */
const ReDialog = withInstall(reDialog);

export type {
  EventType,
  ArgsType,
  DialogProps,
  ButtonProps,
  DialogOptions,
  DialogPayloadApi
} from "./type";
export * from "./store";
export { ReDialog };
