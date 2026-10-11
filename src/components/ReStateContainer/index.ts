import reStateContainer from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 状态容器：loading / empty / error / ready 四态收敛 */
export const ReStateContainer = withInstall(reStateContainer);

export default ReStateContainer;
