// 接口契约类型：由 contract/schema/*.schema.json 生成。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * 路由树（menu_list_to_tree + format_menu_data）
 */
export type RouteNodeList = RouteNode[];

/**
 * 动态路由接口（system/views/routes.py UserRoutesAPIView）的完整响应：ApiResponse 信封 + 路由树 data + 按钮权限码 auths。前端 initRouter/addAsyncRoutes 与 hasAuth 按钮权限体系依赖此形状。服务端由 tests/unit/common/test_contract_schemas.py 持续校验。
 */
export interface RoutesPayload {
  code: 1000;
  detail: string;
  requestId: string;
  timestamp: string;
  /**
   * 按钮级权限码（动作:组件名，如 list:SystemUser），前端 permissionAuths map 的数据源
   */
  auths: string[];
  data: RouteNodeList;
  /**
   * 路由+授权快照内容指纹（get_routes_version md5）：菜单/授权变更即变化，前端本地路由缓存据此失效自愈
   */
  version: string;
  [k: string]: unknown;
}
/**
 * 路由节点（serializer 透传字段放行，仅冻结前端路由消费依赖的键）
 */
export interface RouteNode {
  path: string;
  title?: string | null;
  /**
   * format_menu_meta 仅保留 icon/title/rank/showLink 四键
   */
  meta?: {
    icon?: string | null;
    title?: string | null;
    rank?: number | null;
    showLink?: boolean | null;
    [k: string]: unknown;
  };
  /**
   * 子路由节点（menu_list_to_tree 回填）；与顶层 data 同构递归
   */
  children?: RouteNode[];
  /**
   * menu_list_to_tree 回填的子节点计数
   */
  count?: number;
  [k: string]: unknown;
}
