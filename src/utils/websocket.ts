import qs from "qs";
import { getUsedAccessToken } from "@/utils/token";
import { MessageAction } from "@/utils/websocket/protocol";

/**
 * setTimeout 类型
 */
type Timeout = ReturnType<typeof setTimeout>;

/**
 * setInterval 类型
 */
type Interval = ReturnType<typeof setInterval>;

/**
 * 允许null的泛型
 */
type Nullable<T> = T | null;

/**
 * 默认重连次数上限：默认无限——长会话应用断网恢复后必须能续上（原 3 次上限在
 * 断网超过 1 分钟时即永久掉线）；重试频率由指数退避封顶 30s 保证有界，主动
 * close（登出/组件卸载）会置 socketOpen=false 阻断重连。显式传
 * `reconnectMaxCount` 仍生效（0 = 不重连）。
 */
const reconnectMaxCount = Infinity;
/**
 * 重连退避上限：间隔按次数指数增长并封顶，避免服务端抖动时被固定间隔高频冲击
 */
const reconnectMaxTimeout = 30000;
/**
 * 默认心跳信息
 */
const message = { action: MessageAction.PING };
/**
 * 默认心跳间隔
 */
const interval = 10000;

/**
 * 默认延时时间
 */
const timeout = 3000;

type AutoReconnect = {
  /**
   * 重连尝试次数上限，默认无限（Infinity）；显式传 0 表示不重连
   */
  reconnectMaxCount?: number;
};

type Heartbeat = {
  /**
   * 心跳信息 默认`ping`
   */
  message: string;
  /**
   * 心跳间隔时间 默认 `3000` 毫秒
   */
  interval: number;
};

export interface WSOptions {
  /**
   * 是否自动重连 默认`true`
   */
  autoReconnect?: boolean | AutoReconnect;
  /**
   * 心跳 默认`false`
   */
  heartbeat?: boolean | Heartbeat;
  /**
   * url 携带的参数
   */
  query?: Record<string, string>;
  /**
   * 建立连接成功回调
   */
  openCallback?: (socket: WebSocket) => void;
  /**
   * 关闭连接回调
   */
  closeCallback?: (socket: WebSocket) => void;
  /**
   * 连接异常回调
   */
  errorCallback?: (socket: WebSocket) => void;
}

class WS {
  url: string;
  socketOpen: boolean = false;
  socket: WebSocket | null = null;
  reconnectCount = 0;
  delay: Nullable<Timeout> = null;
  timer: Nullable<Interval> = null;
  autoReconnect: WSOptions["autoReconnect"];
  heartbeat: WSOptions["heartbeat"];
  query: WSOptions["query"];
  openCallback: WSOptions["openCallback"];
  closeCallback: WSOptions["closeCallback"];
  errorCallback: WSOptions["errorCallback"];

  constructor(url?: string, options?: WSOptions) {
    const {
      autoReconnect = true,
      query = {},
      heartbeat = true,
      openCallback = null,
      closeCallback = null,
      errorCallback = null
    } = options || {};
    this.autoReconnect = autoReconnect;
    this.heartbeat = heartbeat;
    this.query = query;
    this.openCallback = openCallback;
    this.closeCallback = closeCallback;
    this.errorCallback = errorCallback;

    this.url =
      `${url}` + qs.stringify({ ...this.query }, { addQueryPrefix: true });

    // 开启连接
    this.connect();
  }

  /**
   * 连接
   */
  connect(): void {
    this.close();
    this.socket = new WebSocket(this.url);
    this.socketOpen = true;
    this.onError();
    this.onOpen();
    // 监听页面可见性：退避等待期间回到前台可立即重连（见 handleVisibilityChange）
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  /**
   * 页面恢复可见时立即重连：断网常发生在页面后台期间，退避计时器最长 30s，
   * 回到前台不必等它走完。主动 close（socketOpen=false）与无需重连时静默跳过；
   * 监听器随 close() 移除、connect() 重挂，避免实例废弃后残留监听。
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible" || !this.autoReconnect) return;
    const closed = !this.socket || this.socket.readyState === WebSocket.CLOSED;
    if (this.socketOpen && closed) {
      // 清掉未到期的退避计时器，避免恢复后定时器再触发造成双重连接
      if (this.delay) {
        clearTimeout(this.delay);
        this.delay = null;
      }
      this.reconnectHandle();
    }
  };

  /**
   * 监听连接
   */
  onOpen(): void {
    if (this.socket) {
      this.socket.onopen = () => {
        this.reconnectCount = 0;
        if (this.openCallback) {
          this.openCallback(this.socket);
        }
        // this.send("ping");
        // 开启心跳
        if (this.heartbeat) {
          this.startHeartbeat();
        }
      };
    }
  }

  /**
   * 开启心跳
   */
  startHeartbeat(): void {
    const msg =
      (this.heartbeat as Heartbeat)?.message || JSON.stringify(message);
    const int = (this.heartbeat as Heartbeat)?.interval || interval;
    this.send(msg);
    this.timer = setInterval(() => {
      this.send(msg);
    }, int);
  }

  reconnectHandle(): void {
    if (this.socketOpen) {
      this.socketOpen = false;
      // 用 ?? 而非 ||：显式传 0 表示"不重连"，不应被默认值覆盖
      const count =
        (this.autoReconnect as AutoReconnect)?.reconnectMaxCount ??
        reconnectMaxCount;
      if (this.autoReconnect && this.reconnectCount < count) {
        this.reconnectCount++;
        this.connect();
      }
    }
  }

  /**
   * 监听错误
   */
  onError(): void {
    if (this.socket) {
      this.socket.onerror = () => {
        if (this.errorCallback) {
          this.errorCallback(this.socket);
        }
      };
      this.socket.onclose = () => {
        if (this.closeCallback) {
          this.closeCallback(this.socket);
        }
        // 指数退避：3s、6s、12s… 封顶 30s，避免服务端抖动时被固定 3s 高频重连冲击
        const backoff = Math.min(
          timeout * 2 ** this.reconnectCount,
          reconnectMaxTimeout
        );
        this.delay = setTimeout(async () => {
          await getUsedAccessToken();
          this.reconnectHandle();
        }, backoff);
      };
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.socketOpen = false;
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    if (this.socket) {
      this.socket.close();
    }
    if (this.delay) {
      clearTimeout(this.delay);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.socket = null;
  }

  /**
   *  监听消息
   * @param callback
   */
  onMessage(callback: (data: unknown) => void): void {
    if (this.socket) {
      this.socket.onmessage = data => {
        try {
          const res = JSON.parse(data.data);
          callback(res);
        } catch {
          callback(data);
        }
      };
    }
  }

  /**
   * 发送消息
   * @param data
   */
  send(data: string | Blob | BufferSource): void {
    if (!this.socket) return;
    // 状态为 `1-开启状态` 直接发送
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(data);
      return;
    }
    // `0-连接中`：等连接就绪后延后发送；`2/3-关闭中/已关闭`：先触发重连再延后发送
    if (this.socket.readyState !== this.socket.CONNECTING) {
      this.connect();
    }
    this.delay = setTimeout(() => {
      this.socket?.send(data);
    }, timeout);
  }
}

const { VITE_WSS_DOMAIN } = import.meta.env;

class PureWebSocket extends WS {
  constructor(username: string, group: string = "xadmin", options?: WSOptions) {
    const url = `${VITE_WSS_DOMAIN}/ws/message/${group}/${username}`;
    super(url, options);
  }
}

/**
 * 聊天室专用通道（服务端 message/consumers.py::ChatNotify）。
 *
 * 与 PureWebSocket（全局通知连接）分离：聊天页自建一条，避免与 user store
 * 的 onmessage 争抢；服务端不为该连接登记登录日志/UserSession。
 */
class ChatWebSocket extends WS {
  constructor(options?: WSOptions) {
    super(`${VITE_WSS_DOMAIN}/ws/chat/`, options);
  }
}

export { WS, PureWebSocket, ChatWebSocket };
