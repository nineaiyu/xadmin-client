import { withInstall } from "@pureadmin/utils";

import ChatMessageAvatar from "./index.vue";

/** 消息头像（AI 图标或昵称首字面兜底） */
const ChatMessageAvatarWithInstall = withInstall(ChatMessageAvatar);

export { ChatMessageAvatarWithInstall };
export default ChatMessageAvatarWithInstall;
export * from "./types";
