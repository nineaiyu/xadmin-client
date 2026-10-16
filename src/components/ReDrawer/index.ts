import reDrawer from "./index.vue";
import { withInstall } from "@pureadmin/utils";

/**
 * 统一出口：组件注册 + 命令式 API 重导出。
 *
 * 命令式 API（store/addDrawer/closeDrawer…）在 `./store`，本文件不承载状态逻辑——
 * 组件（index.vue）与命令式 API 互相需要对方的符号，拆成两个模块可避免
 * `index.vue ↔ index.ts` 的顶层循环导入（环内顶层求值顺序随入口漂移）。
 */
const ReDrawer = withInstall(reDrawer);

export type {
  EventType,
  ArgsType,
  DrawerProps,
  ButtonProps,
  DrawerOptions,
  DrawerPayloadApi
} from "./type";
export * from "./store";
export { ReDrawer };
