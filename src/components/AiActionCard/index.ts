import { withInstall } from "@pureadmin/utils";

import AiActionCard from "./index.vue";

/** AI 受限动作草稿确认卡（聊天室 / 助手页共用） */
const AiActionCardWithInstall = withInstall(AiActionCard);

export { AiActionCardWithInstall };
export default AiActionCardWithInstall;
export * from "./types";
