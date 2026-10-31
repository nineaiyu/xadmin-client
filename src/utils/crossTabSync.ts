/**
 * 跨标签同步（BroadcastChannel 优先，localStorage `storage` 事件兜底）。
 *
 * 登录态（登出 / 令牌吊销）与站点偏好是「同一浏览器多标签共享」的会话状态：
 * 一个标签登出后其他标签若继续持有旧 token，会把无效请求打到服务端；偏好修改
 * 也只落在发起标签的内存里。这里用浏览器原生通道广播最小事件，由订阅方按
 * 「重新读取共享存储 / 清理登录态」的方式收敛（不做消息回放，避免回声）。
 */

export type CrossTabMessage =
  | { type: "user:logout" }
  /** keys = 本次落库实际变更的服务端配置键（接收方只前移这些键的基线） */
  | { type: "site:preferences"; keys?: string[] };

/** 通道名（同源多标签共享） */
const CHANNEL_NAME = "xadmin-cross-tab";
/** 无 BroadcastChannel 时的兜底键（写入即触发其他标签的 storage 事件） */
const FALLBACK_STORAGE_KEY = "xadmin-cross-tab-event";

type Payload = CrossTabMessage & { nonce: string };

export interface CrossTabSync {
  /** 广播一条事件（同标签不回调；发送失败静默降级） */
  publish: (message: CrossTabMessage) => void;
  /** 订阅其他标签的事件，返回取消订阅函数 */
  subscribe: (handler: (message: CrossTabMessage) => void) => () => void;
  /** 移除底层监听并关闭通道（卸载 / 测试清理用） */
  close: () => void;
}

function createNonce(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.type === "string" && typeof record.nonce === "string";
}

/**
 * 创建一个独立的跨标签通道实例。
 *
 * 独立实例而非模块级单例：测试可各自 mock BroadcastChannel / storage，
 * 应用侧默认实例见下方导出的 `publishCrossTab` / `subscribeCrossTab`。
 */
export function createCrossTabSync(): CrossTabSync {
  const subscribers = new Set<(message: CrossTabMessage) => void>();
  let channel: BroadcastChannel | null = null;
  let channelResolved = false;
  let stopListening: (() => void) | null = null;
  let lastNonce = "";
  function resolveChannel(): BroadcastChannel | null {
    if (channelResolved) return channel;
    channelResolved = true;
    if (typeof BroadcastChannel === "undefined") return null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      // Node（单测 / SSR 工具链）的 BroadcastChannel 是活跃句柄：unref 避免挂住进程
      (channel as BroadcastChannel & { unref?: () => void }).unref?.();
    } catch {
      channel = null;
    }
    return channel;
  }
  function dispatch(message: Payload) {
    // 同一事件可能同时经通道与 storage 兜底到达：按 nonce 去重
    if (message.nonce === lastNonce) return;
    lastNonce = message.nonce;
    for (const handler of subscribers) {
      try {
        handler(
          message.type === "site:preferences"
            ? { type: message.type, keys: message.keys ?? [] }
            : { type: message.type }
        );
      } catch (error) {
        console.warn("[cross-tab] handler failed:", error);
      }
    }
  }
  function ensureListening() {
    if (stopListening || typeof window === "undefined") return;
    const activeChannel = resolveChannel();
    if (activeChannel) {
      const onMessage = (event: MessageEvent) => {
        if (isPayload(event.data)) dispatch(event.data);
      };
      activeChannel.addEventListener("message", onMessage);
      stopListening = () => {
        activeChannel.removeEventListener("message", onMessage);
        activeChannel.close();
        channel = null;
        channelResolved = false;
        stopListening = null;
      };
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FALLBACK_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (isPayload(parsed)) dispatch(parsed);
      } catch {
        // 非本通道写入或结构不合法：忽略
      }
    };
    window.addEventListener("storage", onStorage);
    stopListening = () => {
      window.removeEventListener("storage", onStorage);
      stopListening = null;
    };
  }
  return {
    publish(message) {
      const payload = { ...message, nonce: createNonce() } as Payload;
      const activeChannel = resolveChannel();
      if (activeChannel) {
        try {
          activeChannel.postMessage(payload);
        } catch (error) {
          console.warn("[cross-tab] broadcast failed:", error);
        }
        return;
      }
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // 存储被禁用（隐私模式 / 配额耗尽）：跨标签同步静默降级
      }
    },
    subscribe(handler) {
      ensureListening();
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },
    close() {
      subscribers.clear();
      stopListening?.();
    }
  };
}

const shared = createCrossTabSync();

export const publishCrossTab = shared.publish;

export const subscribeCrossTab = shared.subscribe;

export function closeCrossTabSync(): void {
  shared.close();
}
