import { withInstall } from "@pureadmin/utils";

import ApiScopeEditor from "./index.vue";

/** 接口范围编辑器（令牌 / API 应用共用） */
const ApiScopeEditorWithInstall = withInstall(ApiScopeEditor);

export { ApiScopeEditorWithInstall };
export default ApiScopeEditorWithInstall;
export * from "./types";
