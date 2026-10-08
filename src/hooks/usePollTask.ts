import { getCurrentScope, onScopeDispose } from "vue";

/** 待轮询任务的最小形态：服务端下发的运行态（额外字段原样透传给回调） */
export interface PollTaskState {
  /** 运行态标识（running/idle/done/error 等，语义由 isFinal 判定） */
  state: string;
}

export interface UsePollTaskOptions<S extends PollTaskState> {
  /** 单次状态查询：返回 null 表示本轮无效（下轮重试） */
  query: () => Promise<S | null>;
  /** 轮询间隔（毫秒）：每轮先等待再查询，避免立即打首包 */
  interval: number;
  /** 超时时长（毫秒）：超过后停止并触发 onTimeout */
  timeout: number;
  /** 终态判定：返回 true 即停止轮询并触发 onFinal */
  isFinal: (result: S) => boolean;
  /** 非终态回调（进度提示等，可选） */
  onTick?: (result: S) => void;
  /** 终态回调 */
  onFinal: (result: S) => void;
  /** 超时回调 */
  onTimeout: () => void;
}

export interface UsePollTaskReturn {
  /** 启动轮询；终态或超时后 resolve（被取消则不 resolve） */
  start: () => Promise<void>;
  /** 主动取消：清定时器并置取消标志，后续不再发起查询 */
  cancel: () => void;
}

/**
 * 后台任务状态轮询（知识库同步 / 向量构建等共用）。
 *
 * 统一行为：
 * - 每轮先 `interval` 等待再查询，查询抛错由调用方在 query 内归一；
 * - 非终态调用 onTick、终态调用 onFinal 并结束；
 * - 超过 `timeout` 调用 onTimeout 并结束；
 * - **可取消**：组件卸载（effect scope 销毁）时清理挂起的定时器并置取消标志，
 *   挂起的循环不再推进、不再发起请求、不再弹消息。定时器随创建时的作用域注册，
 *   须在 setup（或 effectScope）内创建。
 */
export function usePollTask<S extends PollTaskState>(
  options: UsePollTaskOptions<S>
): UsePollTaskReturn {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const stopTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const cancel = () => {
    cancelled = true;
    stopTimer();
  };

  if (getCurrentScope()) {
    onScopeDispose(cancel);
  }

  /** 等待一个轮询间隔；句柄记录在 timer 上，取消即清理（promise 不再 resolve） */
  const waitTick = () =>
    new Promise<void>(resolve => {
      timer = setTimeout(() => {
        timer = null;
        resolve();
      }, options.interval);
    });

  const start = async (): Promise<void> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < options.timeout) {
      await waitTick();
      // 作用域销毁后可能已进入本轮：此处收口，避免取消竞态下的多余请求
      if (cancelled) return;
      const result = await options.query();
      if (cancelled) return;
      if (!result) continue;
      if (!options.isFinal(result)) {
        options.onTick?.(result);
        continue;
      }
      options.onFinal(result);
      return;
    }
    if (!cancelled) options.onTimeout();
  };

  return { start, cancel };
}
