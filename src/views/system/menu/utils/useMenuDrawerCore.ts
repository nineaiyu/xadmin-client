import {
  createMenuDrawerSession,
  type MenuDrawerSessionDeps
} from "./menuDrawerSession";

/**
 * 菜单抽屉核心状态机（自 useMenuDrawer 抽出）：打开态 / 脏检查 / 关闭 /
 * 未保存拦截 / 打开（三种打开动作共用同一抽屉壳）。
 *
 * 队列与会话细节（复用 / 延后入队 / 清理令牌）在 menuDrawerSession，
 * 本文件只保留接线，避免 hook 超长。
 */
export function useMenuDrawerCore(deps: MenuDrawerSessionDeps) {
  return createMenuDrawerSession(deps);
}
