import { withInstall } from "@pureadmin/utils";

import AiMessageBlock from "./index.vue";

/** AI 回复统一块（思考面板 + 正文 + 出处） */
const AiMessageBlockWithInstall = withInstall(AiMessageBlock);

export { AiMessageBlockWithInstall };
export default AiMessageBlockWithInstall;
export * from "./types";
