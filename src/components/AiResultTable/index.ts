import { withInstall } from "@pureadmin/utils";

import AiResultTable from "./index.vue";

/** AI 只读动作结果表（指标/列表自动成表） */
const AiResultTableWithInstall = withInstall(AiResultTable);

export { AiResultTableWithInstall };
export default AiResultTableWithInstall;
export * from "./types";
