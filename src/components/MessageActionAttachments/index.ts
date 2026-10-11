import { withInstall } from "@pureadmin/utils";

import MessageActionAttachments from "./index.vue";

/** 消息内嵌动作渲染（草稿卡 + 只读结果表） */
const MessageActionAttachmentsWithInstall = withInstall(
  MessageActionAttachments
);

export { MessageActionAttachmentsWithInstall };
export default MessageActionAttachmentsWithInstall;
export * from "./types";
