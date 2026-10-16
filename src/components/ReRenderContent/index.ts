import reRenderContent from "./src/index.tsx";
import { withInstall } from "@pureadmin/utils";

/** 内容渲染器：字符串 / 数字 / 组件 / VNode → VNode */
export const ReRenderContent = withInstall(reRenderContent);

export default ReRenderContent;
export * from "./src/types";
