import reTableAction from "./src/index";
import { withInstall } from "@pureadmin/utils";

/** 通用表格操作列：行内主操作 + 更多下拉，契约对齐 vben VbenTableAction */
export const ReTableAction = withInstall(reTableAction);

export * from "./src/types";

export default ReTableAction;
