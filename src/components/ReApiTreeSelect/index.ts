import reApiTreeSelect from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/** 远程取数的树形选择（与 ReApiSelect 共用取数 / 归一逻辑） */
export const ReApiTreeSelect = withInstall(reApiTreeSelect);

export default ReApiTreeSelect;
