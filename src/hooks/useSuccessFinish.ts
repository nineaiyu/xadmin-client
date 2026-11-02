import { onBeforeUnmount } from "vue";

/**
 * 成功态保活定时器：调度后可在取消/重置/卸载时统一清理。
 *
 * 用于「成功反馈需要保持一小段时间（读屏播报 / 视觉确认）」的交互，
 * 避免 setTimeout 句柄散落在组件内、组件卸载后仍在已销毁实例上回调。
 */
export function useSuccessFinish(
  finish: (ticket: string) => void,
  delayMs = 1000
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  /** 延迟执行 finish；重复调度只保留最后一次 */
  const schedule = (ticket: string) => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      finish(ticket);
    }, delayMs);
  };

  /** 立即执行（跳过保活窗口） */
  const flush = (ticket: string) => {
    clear();
    finish(ticket);
  };

  onBeforeUnmount(clear);

  return { schedule, flush, clear };
}
