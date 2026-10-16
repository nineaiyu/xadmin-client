import reJsonViewer from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** JSON 树形查看组件（懒加载 vue-json-pretty，仅在使用处引入时加载其 JS + CSS） */
export const ReJsonViewer = withInstall(reJsonViewer);

export default ReJsonViewer;
export type { JsonViewerProps, JsonViewerAction } from "./src/types";
