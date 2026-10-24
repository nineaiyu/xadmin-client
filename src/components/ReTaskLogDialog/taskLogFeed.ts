import { WS } from "@/utils/websocket";
import {
  MessageAction,
  isOutboundMessage,
  type TaskLogPayload
} from "@/utils/websocket/protocol";
import type { TaskLogChunk } from "@/api/task/task";

/**
 * 任务日志数据源：优先 WebSocket 增量推送，失败即降级 HTTP offset 轮询。
 *
 * 后端两条通道读的是同一份日志文件（`task/utils/task_log.py`），
 * HTTP `GET /api/task/executions/<pk>/log?offset=` 是 WS 的等价兜底：
 * - WS 鉴权失败（4401 未登录 / 4403 无权）不是「暂无输出」，直接给终态；
 * - 代理不支持升级、连接被重置、服务端异常断开等（1006 等）降级轮询；
 * - 超过 PUSH_TIMEOUT 没有任何帧（连接假活）同样降级，避免永久转圈。
 */

export type TaskLogStatus =
  | "connecting"
  | "streaming"
  | "polling"
  | "finished"
  | "unauthorized"
  | "forbidden"
  | "failed";

export type { TaskLogChunk };

/** 连接假活判定：服务端空转最长 15s 一帧，超过该时长仍无输出即降级 */
export const PUSH_TIMEOUT = 20_000;
/** 轮询间隔：与后端 WS 基础推送间隔一致 */
export const POLL_INTERVAL = 2_000;

type SocketLike = {
  close: () => void;
  addEventListener?: (
    type: string,
    cb: (event: { code?: number }) => void
  ) => void;
};

export type TaskLogFeedOptions = {
  url: string;
  fetchChunk: (offset: number) => Promise<TaskLogChunk>;
  onChunk: (chunk: TaskLogChunk) => void;
  onStatus: (status: TaskLogStatus, detail?: string) => void;
  /** 测试注入：默认建真实 WS 并监听 close 事件码 */
  createSocket?: (
    url: string,
    handlers: {
      onMessage: (payload: unknown) => void;
      onClose: (code?: number) => void;
    }
  ) => SocketLike;
  pollInterval?: number;
  pushTimeout?: number;
};

export type TaskLogFeed = {
  start: () => void;
  stop: () => void;
  /** 失败态重试：从当前偏移继续轮询（已收到内容不丢） */
  retry: () => void;
};

type CloseHandler = (code?: number) => void;

/** 默认通道：WS 实例自身的 closeCallback 不带事件码，额外挂 close 监听取码 */
function createDefaultSocket(
  url: string,
  handlers: {
    onMessage: (payload: unknown) => void;
    onClose: CloseHandler;
  }
) {
  // 不传 closeCallback：WS 类的 closeCallback 不带事件码，且会先于 close 监听触发，
  // 会让 4401/4403 丢失。只在原生 close 事件里取码，两种断开都走同一入口。
  const socket = new WS(url, { autoReconnect: false });
  socket.onMessage(handlers.onMessage);
  socket.socket?.addEventListener("close", event => {
    handlers.onClose((event as CloseEvent).code);
  });
  return socket;
}

export function createTaskLogFeed(options: TaskLogFeedOptions): TaskLogFeed {
  const {
    url,
    fetchChunk,
    onChunk,
    onStatus,
    createSocket = createDefaultSocket,
    pollInterval = POLL_INTERVAL,
    pushTimeout = PUSH_TIMEOUT
  } = options;

  let socket: SocketLike | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let offset = 0;
  let finished = false;
  let polling = false;

  const clearTimers = () => {
    if (pollTimer) clearTimeout(pollTimer);
    if (idleTimer) clearTimeout(idleTimer);
    pollTimer = null;
    idleTimer = null;
  };

  const stop = () => {
    stopped = true;
    clearTimers();
    socket?.close();
    socket = null;
  };

  const applyChunk = (chunk: TaskLogChunk) => {
    offset = chunk.offset ?? offset;
    if (chunk.content) onChunk(chunk);
    if (chunk.finished) {
      finished = true;
      clearTimers();
      socket?.close();
      socket = null;
      onStatus("finished");
    }
  };

  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // 连接假活：主动断开并降级轮询（服务端 close 回调会再触发一次，由 polling 幂等）
      socket?.close();
      socket = null;
      void startPolling();
    }, pushTimeout);
  };

  const startPolling = async () => {
    if (stopped || finished || polling) return;
    polling = true;
    clearTimers();
    onStatus("polling");
    const tick = async (): Promise<void> => {
      if (stopped || finished) return;
      try {
        const chunk = await fetchChunk(offset);
        if (stopped) return;
        applyChunk(chunk);
        if (finished) return;
        pollTimer = setTimeout(() => void tick(), pollInterval);
      } catch (error) {
        if (stopped) return;
        onStatus(
          "failed",
          String((error as { detail?: string })?.detail ?? error ?? "")
        );
      }
    };
    await tick();
  };

  const handleClose = (code?: number) => {
    if (stopped || finished) return;
    if (code === 4401) {
      stopped = true;
      clearTimers();
      socket = null;
      onStatus("unauthorized");
      return;
    }
    if (code === 4403) {
      stopped = true;
      clearTimers();
      socket = null;
      onStatus("forbidden");
      return;
    }
    // 正常收尾（服务端推完主动断开）由 finished 分支处理；这里只兜底异常断开
    socket = null;
    void startPolling();
  };

  const start = () => {
    stopped = false;
    onStatus("connecting");
    socket = createSocket(url, {
      onMessage: (payload: unknown) => {
        if (!isOutboundMessage<TaskLogPayload>(payload, MessageAction.TASK_LOG))
          return;
        const data = payload.data;
        if (!data) return;
        armIdleTimer();
        applyChunk(data);
        // 帧已到但还没结束：标记为实时流式（finished 分支会再覆盖为 finished）
        if (!finished && !stopped) onStatus("streaming");
      },
      onClose: handleClose
    });
    armIdleTimer();
  };

  const retry = () => {
    if (stopped || finished) return;
    polling = false;
    void startPolling();
  };

  return { start, stop, retry };
}
