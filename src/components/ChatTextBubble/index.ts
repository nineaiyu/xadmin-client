import { withInstall } from "@pureadmin/utils";

import ChatTextBubble from "./index.vue";

/** 文本气泡（自己/他人、撤回占位、弱化态） */
const ChatTextBubbleWithInstall = withInstall(ChatTextBubble);

export { ChatTextBubbleWithInstall };
export default ChatTextBubbleWithInstall;
export * from "./types";
