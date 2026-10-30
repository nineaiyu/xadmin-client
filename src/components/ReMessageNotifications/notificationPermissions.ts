/**
 * 消息订阅面板的行内动作显隐（纯函数，便于显隐矩阵单测）。
 *
 * - 发送测试：独立权限点 `test:SystemMsgSubscription`；
 * - 编辑接收人：写操作，复用 `partialUpdate:SystemMsgSubscription`；
 * - 操作列：两者都没有时不渲染（只读角色只看到订阅与渠道列）。
 */
export interface NotificationAuth {
  list?: boolean;
  partialUpdate?: boolean;
  backends?: boolean;
  test?: boolean;
}

export function notificationActionVisibility(
  auth: NotificationAuth,
  hasOperations: boolean
) {
  return {
    column: Boolean(auth.test || (hasOperations && auth.partialUpdate)),
    test: Boolean(auth.test),
    receivers: Boolean(hasOperations && auth.partialUpdate)
  };
}
