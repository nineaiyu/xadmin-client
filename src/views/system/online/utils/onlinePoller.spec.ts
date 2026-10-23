import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOnlinePoller, ONLINE_REFRESH_INTERVAL_MS } from "./onlinePoller";

describe("createOnlinePoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("按间隔轮询；start 幂等，stop 后不再触发", () => {
    const refresh = vi.fn();
    const poller = createOnlinePoller(refresh, { isHidden: () => false });

    poller.start();
    poller.start(); // 重复 start 不应叠加定时器
    vi.advanceTimersByTime(ONLINE_REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    poller.stop();
    expect(poller.running).toBe(false);
    vi.advanceTimersByTime(ONLINE_REFRESH_INTERVAL_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("页面隐藏时跳过本轮（切回可见后恢复）", () => {
    const refresh = vi.fn();
    let hidden = true;
    const poller = createOnlinePoller(refresh, { isHidden: () => hidden });

    poller.start();
    vi.advanceTimersByTime(ONLINE_REFRESH_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();

    hidden = false;
    vi.advanceTimersByTime(ONLINE_REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it("refreshNow 走同一隐藏判定（手动刷新也不打隐藏页）", () => {
    const refresh = vi.fn();
    let hidden = false;
    const poller = createOnlinePoller(refresh, { isHidden: () => hidden });

    poller.refreshNow();
    hidden = true;
    poller.refreshNow();

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
