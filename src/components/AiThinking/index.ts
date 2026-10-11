import { withInstall } from "@pureadmin/utils";

import AiThinking from "./index.vue";

/** AI 思考过程面板（流式自动展开 / 完成收起） */
const AiThinkingWithInstall = withInstall(AiThinking);

export { AiThinkingWithInstall };
export default AiThinkingWithInstall;
export * from "./types";
