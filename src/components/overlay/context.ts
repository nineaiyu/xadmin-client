/**
 * 页脚按钮回调上下文：ReDialog 传 `{ dialog }`、ReDrawer 传 `{ drawer }`，
 * 共享层按同一形状取出 options / index。
 */
export function dialogOrDrawer<TOptions>(ctx: unknown): {
  options: TOptions;
  index: number;
} {
  const value = ctx as {
    dialog?: { options: TOptions; index: number };
    drawer?: { options: TOptions; index: number };
  };
  return (value.dialog ?? value.drawer) as {
    options: TOptions;
    index: number;
  };
}
