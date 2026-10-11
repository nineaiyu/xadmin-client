import reResize from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 可拖拽 / 可缩放盒子（拖动移动 + 八向手柄缩放） */
export const ReResize = withInstall(reResize);

export default ReResize;
export type { Box, BoxConstraints } from "./src/geometry";
export { clampToParent, dragBox, resizeBox } from "./src/geometry";
