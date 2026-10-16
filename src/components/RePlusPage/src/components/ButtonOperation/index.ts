import buttonOperation from "./src/index.vue";
import operationButton from "./src/OperationButton";
import { withInstall } from "@pureadmin/utils";

export const ButtonOperation = withInstall(buttonOperation);

/**
 * 单个操作按钮渲染器：稳定组件引用（含「确认框在下拉内」的交互兜底），
 * 供操作列容器与通用操作列组件复用。
 */
export const OperationButton = operationButton;

export * from "./src/types";

export default ButtonOperation;
