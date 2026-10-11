import { withInstall } from "@pureadmin/utils";

import NewMessagesBadge from "./index.vue";

/** 离底新消息悬浮条（计数 > 0 出现） */
const NewMessagesBadgeWithInstall = withInstall(NewMessagesBadge);

export { NewMessagesBadgeWithInstall };
export default NewMessagesBadgeWithInstall;
export * from "./types";
