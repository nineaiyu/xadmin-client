import reScrollbar from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 增强滚动条：到达态事件 + 遮罩阴影（底层 el-scrollbar） */
export const ReScrollbar = withInstall(reScrollbar);

export default ReScrollbar;
export * from "./src/types";
