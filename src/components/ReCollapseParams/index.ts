import reCollapseParams from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 参数折叠面板：三列（名称 / 值 / 说明）+ 折叠（底层 Element Plus 输入控件） */
export const ReCollapseParams = withInstall(reCollapseParams);

export default ReCollapseParams;
export * from "./src/types";
export {
  applyParamDefaults,
  limitDisplay,
  pickAllowed,
  splitParams
} from "./src/paramsFold";
