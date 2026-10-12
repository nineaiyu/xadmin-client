import reBackTop from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 回到顶部：默认目标为本项目布局内容区滚动容器 */
export const ReBackTop = withInstall(reBackTop);

export default ReBackTop;
export * from "./src/types";
