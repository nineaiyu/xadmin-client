import { withInstall } from "@pureadmin/utils";

import ChatSystemNotice from "./index.vue";

/** 系统提示窄条（含可选下方插槽） */
const ChatSystemNoticeWithInstall = withInstall(ChatSystemNotice);

export { ChatSystemNoticeWithInstall };
export default ChatSystemNoticeWithInstall;
export * from "./types";
