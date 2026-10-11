import { withInstall } from "@pureadmin/utils";

import MessageTimeDivider from "./index.vue";

/** 消息流时间分隔行 */
const MessageTimeDividerWithInstall = withInstall(MessageTimeDivider);

export { MessageTimeDividerWithInstall };
export default MessageTimeDividerWithInstall;
export * from "./types";
