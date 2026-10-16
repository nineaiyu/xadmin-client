import { withInstall } from "@pureadmin/utils";

import MessageThreadPanel from "./index.vue";

/** 消息流面板骨架（头部 + 消息区 + 输入区插槽） */
const MessageThreadPanelWithInstall = withInstall(MessageThreadPanel);

export { MessageThreadPanelWithInstall };
export default MessageThreadPanelWithInstall;
export * from "./types";
