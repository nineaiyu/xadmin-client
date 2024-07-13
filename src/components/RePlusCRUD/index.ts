import rePlusCRUD from "./src/index.vue";
import { withInstall } from "@pureadmin/utils";

/**
 * ProComponents自定义的curd组件，详细文档参考 https://plus-pro-components.com/
 */
export const RePlusCRUD = withInstall(rePlusCRUD);

export * from "./src/utils/index";
export * from "./src/utils/columns";
export * from "./src/utils/renders";
export * from "./src/utils/handle";
export * from "./src/components/buttonOperation";
export * from "./src/utils/types";

export default RePlusCRUD;
