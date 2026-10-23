/**
 * 在线会话页的自动刷新节拍器（纯逻辑，不依赖组件，便于假定时器单测）。
 *
 * 在线列表是「缓存快照 + 定时清理」的口径，页面不刷新就会一直显示已下线用户、
 * 也看不到新登录用户；而隐藏标签页 / 后台路由继续轮询只会白耗接口。
 */
export const ONLINE_REFRESH_INTERVAL_MS = 30_000;

export interface OnlinePoller {
  start: () => void;
  stop: () => void;
  /** 立即执行一次（手动刷新入口复用同一「隐藏即跳过」口径） */
  refreshNow: () => void;
  readonly running: boolean;
}

export function createOnlinePoller(
  refresh: () => void,
  {
    intervalMs = ONLINE_REFRESH_INTERVAL_MS,
    isHidden = () => document.hidden
  }: {
    intervalMs?: number;
    isHidden?: () => boolean;
  } = {}
): OnlinePoller {
  let timer: ReturnType<typeof setInterval> | undefined;

  const run = () => {
    if (isHidden()) return;
    refresh();
  };

  return {
    start() {
      if (timer !== undefined) return;
      timer = setInterval(run, intervalMs);
    },
    stop() {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    },
    refreshNow: run,
    get running() {
      return timer !== undefined;
    }
  };
}
