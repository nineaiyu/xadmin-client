// 路由工具按职责拆分（route-tree / async-routes / auth / nav），
// 对外 API 由本文件统一再导出，导入路径保持 "@/router/utils" 不变。
export {
  type Auths,
  getAuths,
  hasAuth,
  getDefaultAuths,
  usePageAuth
} from "./auth";
export { initRouter, addPathMatch, addAsyncRoutes } from "./async-routes";
export { getTopMenu, handleAliveRoute } from "./nav";
export { hasInAppHistory, goBackOrHome, getHistoryMode } from "./history";
export {
  ascending,
  filterTree,
  isOneOfArray,
  getParentPaths,
  findRouteByPath,
  formatTwoStageRoutes,
  formatFlatteningRoutes,
  filterNoPermissionTree,
  toMenuNode,
  toMenuTree
} from "./route-tree";
