import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePollTask } from "./usePollTask";

type Status = { state: string; percent?: number };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** 按顺序出队的状态；耗尽后返回 null（视为无效轮询） */
const queuedQuery = (statuses: (Status | null)[]) => {
  const queue = [...statuses];
  return vi.fn(async () => queue.shift() ?? null);
};

describe("usePollTask", () => {
  it("非终态逐轮回调 onTick，终态回调 onFinal 后结束", async () => {
    const query = queuedQuery([
      { state: "running", percent: 10 },
      { state: "running", percent: 60 },
      { state: "done" }
    ]);
    const onTick = vi.fn();
    const onFinal = vi.fn();
    const onTimeout = vi.fn();

    const poll = usePollTask<Status>({
      query,
      interval: 1000,
      timeout: 10000,
      isFinal: status => status.state === "done",
      onTick,
      onFinal,
      onTimeout
    });

    const pending = poll.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await pending;

    expect(query).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onFinal).toHaveBeenCalledWith({ state: "done" });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("查询返回 null 视为无效轮询，继续下一轮", async () => {
    const query = queuedQuery([null, { state: "error" }]);
    const onFinal = vi.fn();

    const poll = usePollTask<Status>({
      query,
      interval: 500,
      timeout: 10000,
      isFinal: status => status.state === "error",
      onFinal,
      onTimeout: vi.fn()
    });

    const pending = poll.start();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    await pending;

    expect(query).toHaveBeenCalledTimes(2);
    expect(onFinal).toHaveBeenCalledWith({ state: "error" });
  });

  it("超过 timeout 触发 onTimeout 且不再回调终态", async () => {
    const onFinal = vi.fn();
    const onTimeout = vi.fn();

    const poll = usePollTask<Status>({
      query: vi.fn(async () => ({ state: "running" })),
      interval: 1000,
      timeout: 3000,
      isFinal: status => status.state === "done",
      onFinal,
      onTimeout
    });

    const pending = poll.start();
    await vi.advanceTimersByTimeAsync(3000);
    await pending;

    expect(onFinal).not.toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("作用域销毁即取消：不再发起请求、不再弹超时", async () => {
    const query = vi.fn(async () => ({ state: "running" }) as Status);
    const onFinal = vi.fn();
    const onTimeout = vi.fn();

    const scope = effectScope();
    let poll!: ReturnType<typeof usePollTask>;
    scope.run(() => {
      poll = usePollTask<Status>({
        query,
        interval: 1000,
        timeout: 10000,
        isFinal: status => status.state === "done",
        onFinal,
        onTimeout
      });
    });

    const pending = poll.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(query).toHaveBeenCalledTimes(1);

    scope.stop();
    await vi.advanceTimersByTimeAsync(10000);

    expect(query).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
    // 取消后挂起的轮询不再收敛属预期（定时器已清理），仅防未处理异常
    void pending;
  });

  it("cancel() 主动取消后不再发起请求", async () => {
    const query = vi.fn(async () => ({ state: "running" }) as Status);
    const poll = usePollTask<Status>({
      query,
      interval: 1000,
      timeout: 10000,
      isFinal: status => status.state === "done",
      onFinal: vi.fn(),
      onTimeout: vi.fn()
    });

    const pending = poll.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(query).toHaveBeenCalledTimes(1);

    poll.cancel();
    await vi.advanceTimersByTimeAsync(10000);
    expect(query).toHaveBeenCalledTimes(1);
    void pending;
  });
});
