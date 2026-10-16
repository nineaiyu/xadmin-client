import { withInstall } from "@pureadmin/utils";

import AiStreamingBubble from "./index.vue";

/** AI 流式回答气泡（头像 + 名字行 + 停止生成） */
const AiStreamingBubbleWithInstall = withInstall(AiStreamingBubble);

export { AiStreamingBubbleWithInstall };
export default AiStreamingBubbleWithInstall;
export * from "./types";
