import rePlusPage from "./src/index.vue";
import reRecycleBin from "./src/components/ReRecycleBin.vue";

export const RePlusPage = rePlusPage;

/** FEAT-2：通用回收站抽屉（RePlusPage 经 recycleBin prop 内建渲染；亦可独立使用） */
export const ReRecycleBin = reRecycleBin;

export * from "./src/utils/index";
export * from "./src/utils/columns";
export * from "./src/utils/renders";
export * from "./src/utils/handle";
export * from "./src/utils/registry";
export * from "./src/components/ButtonOperation";
export * from "./src/utils/types";
export * from "./src/utils/public";
