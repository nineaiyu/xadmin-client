/**
 * 挑战会话生命周期：进行中的 Promise、ticket resolve/reject 与去重。
 *
 * 从组件抽出以保持 SFC 行数在门禁内（组件只保留展示与交互编排）。
 */
export function useChallengeSession(options: {
  /** 关闭当前展示（弹窗/内联/浮层/绑定态） */
  deactivate: () => void;
  /** 成功回调（emit success） */
  onSuccess: (ticket: string) => void;
  /** 打开挑战前的准备（重置 honeypot、请求题目） */
  onOpen: () => void;
}) {
  let pending: Promise<string> | null = null;
  let resolvePending: ((_ticket: string) => void) | null = null;
  let rejectPending: ((_reason: Error) => void) | null = null;

  function clearPending() {
    resolvePending = null;
    rejectPending = null;
    pending = null;
  }

  function finish(ticket: string) {
    if (!resolvePending) return;
    const resolve = resolvePending;
    clearPending();
    options.deactivate();
    resolve(ticket);
    options.onSuccess(ticket);
  }

  function cancel() {
    if (!rejectPending) return;
    const reject = rejectPending;
    clearPending();
    options.deactivate();
    reject(new Error("captcha-cancelled"));
  }

  /** 打开挑战并等待 ticket；重复调用返回同一个进行中的 Promise */
  function open(): Promise<string> {
    if (pending) return pending;
    options.onOpen();
    pending = new Promise<string>((_resolve, _reject) => {
      resolvePending = _resolve;
      rejectPending = _reject;
    });
    return pending;
  }

  return {
    open,
    cancel,
    finish,
    clearPending,
    hasPending: () => Boolean(resolvePending || rejectPending)
  };
}
