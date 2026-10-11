import { withInstall } from "@pureadmin/utils";

import ChatMessageList from "./index.vue";

/** 消息列表壳（滚动容器 + 骨架 + 加载更早 + 空态） */
const ChatMessageListWithInstall = withInstall(ChatMessageList);

export { ChatMessageListWithInstall };
export default ChatMessageListWithInstall;
export * from "./types";
