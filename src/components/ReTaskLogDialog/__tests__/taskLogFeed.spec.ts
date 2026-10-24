import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTaskLogFeed,
  type TaskLogChunk,
  type TaskLogStatus
} from "../taskLogFeed";

type SocketHandler = {
  onMessage: (payload: unknown) => void;
  onClose: (code?: number) => void;
};

function makeSocket() {
  // 由 createSocket 注入用例侧回调（未注入前可选，避免空函数 lint）
  const handlers: Partial<SocketHandler> = {};
  const socket = {
    closed: false,
    close: vi.fn(() => {
      socket.closed = true;
    })
  };
  return { socket, handlers };
}

function frame(chunk: TaskLogChunk) {
  return { action: "task_log", data: chunk };
}

const statuses: TaskLogStatus[] = [];

function setup(
  options: {
    fetchChunk?: (offset: number) => Promise<TaskLogChunk>;
    pushTimeout?: number;
    pollInterval?: number;
  } = {}
) {
  const { socket, handlers } = makeSocket();
  statuses.length = 0;
  const content: string[] = [];
  const failures: string[] = [];
  const feed = createTaskLogFeed({
    url: "ws://localhost/ws/tasks/log/1",
    createSocket: (_url, captured) => {
      handlers.onMessage = captured.onMessage;
      handlers.onClose = captured.onClose;
      return socket;
    },
    fetchChunk:
      options.fetchChunk ??
      vi.fn(async () => ({ offset: 0, content: "", finished: true })),
    onChunk: chunk => content.push(chunk.content),
    onStatus: (status, detail) => {
      statuses.push(status);
      if (detail) failures.push(detail);
    },
    pollInterval: options.pollInterval ?? 1000,
    pushTimeout: options.pushTimeout ?? 5000
  });
  return { feed, socket, handlers, content, failures };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("createTaskLogFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("WS 正常推送：追加内容并在 finished 后收尾", async () => {
    const { feed, handlers, content, socket } = setup();
    feed.start();
    expect(statuses).toEqual(["connecting"]);

    handlers.onMessage?.(frame({ offset: 3, content: "abc", finished: false }));
    expect(content).toEqual(["abc"]);
    expect(statuses).toEqual(["connecting", "streaming"]);

    handlers.onMessage?.(frame({ offset: 6, content: "def", finished: true }));
    expect(content).toEqual(["abc", "def"]);
    expect(statuses.at(-1)).toBe("finished");
    expect(socket.close).toHaveBeenCalled();
  });

  it("4401/4403 是鉴权终态，不降级轮询", () => {
    const first = setup();
    first.feed.start();
    first.handlers.onClose?.(4401);
    expect(statuses.at(-1)).toBe("unauthorized");

    const second = setup();
    second.feed.start();
    second.handlers.onClose?.(4403);
    expect(statuses.at(-1)).toBe("forbidden");
  });

  it("异常断开（1006）降级 HTTP 轮询，按 offset 续读至结束", async () => {
    const fetchChunk = vi
      .fn()
      .mockResolvedValueOnce({ offset: 4, content: "poll", finished: false })
      .mockResolvedValueOnce({ offset: 8, content: "tail", finished: true });
    const { feed, handlers, content } = setup({ fetchChunk });
    feed.start();

    handlers.onClose?.(1006);
    await flush();
    expect(statuses).toContain("polling");
    expect(fetchChunk).toHaveBeenCalledWith(0);
    expect(content).toEqual(["poll"]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchChunk).toHaveBeenLastCalledWith(4);
    expect(content).toEqual(["poll", "tail"]);
    expect(statuses.at(-1)).toBe("finished");
  });

  it("轮询失败进入 failed 并可用 retry 从当前偏移继续", async () => {
    const fetchChunk = vi
      .fn()
      .mockRejectedValueOnce({ detail: "读取失败" })
      .mockResolvedValueOnce({ offset: 2, content: "ok", finished: true });
    const { feed, handlers, failures } = setup({ fetchChunk });
    feed.start();

    handlers.onClose?.(1006);
    await flush();
    expect(statuses.at(-1)).toBe("failed");
    expect(failures).toEqual(["读取失败"]);

    feed.retry();
    await flush();
    expect(statuses.at(-1)).toBe("finished");
    expect(fetchChunk).toHaveBeenCalledTimes(2);
  });

  it("连接假活：超过 pushTimeout 无帧即降级轮询", async () => {
    const fetchChunk = vi.fn(async () => ({
      offset: 1,
      content: "later",
      finished: true
    }));
    const { feed, socket } = setup({ fetchChunk, pushTimeout: 3000 });
    feed.start();

    await vi.advanceTimersByTimeAsync(3000);
    await flush();
    expect(statuses).toContain("polling");
    expect(fetchChunk).toHaveBeenCalled();
    // 假活降级后原 WS 连接必须关闭，避免两路并行
    expect(socket.close).toHaveBeenCalled();
  });

  it("stop 后不再轮询", async () => {
    const fetchChunk = vi.fn(async () => ({
      offset: 1,
      content: "x",
      finished: false
    }));
    const { feed, handlers } = setup({ fetchChunk });
    feed.start();
    handlers.onClose?.(1006);
    await flush();
    expect(fetchChunk).toHaveBeenCalledTimes(1);

    feed.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchChunk).toHaveBeenCalledTimes(1);
  });
});
