/**
 * WebSocket 消息协议类型（与 server message/protocol.py 对齐，ADR-003）。
 *
 * 上行/下行帧均为 JSON：
 * ```json
 * { "action": "chat_message", "data": {...}, "mid": "可选", "v": 1 }
 * ```
 * 出站帧额外含 code / detail / timestamp（服务端 send_base_json）。
 * 新增 action：在 MessageAction 登记 + 补对应 Payload 接口。
 */

/** 协议版本，与服务端 PROTOCOL_VERSION 对齐 */
export const WS_PROTOCOL_VERSION = 1;

/** 消息动作（字符串常量，与服务端 MessageAction 一致） */
export const MessageAction = {
  /** 心跳：上行 ping → 下行 data='pong' */
  PING: "ping",
  /** 请求/推送当前登录用户信息 */
  USERINFO: "userinfo",
  /** 站内信/通知推送 */
  PUSH_MESSAGE: "push_message",
  /** 聊天室消息（双向） */
  CHAT_MESSAGE: "chat_message",
  /** 任务执行日志增量推送 */
  TASK_LOG: "task_log"
} as const;

export type MessageActionValue =
  (typeof MessageAction)[keyof typeof MessageAction];

/** 客户端→服务端帧 */
export interface InboundMessage<T = unknown> {
  action: MessageActionValue;
  data?: T;
  mid?: string;
  v?: number;
}

/** 服务端→客户端帧 */
export interface OutboundMessage<T = unknown> extends InboundMessage<T> {
  code: number;
  detail: string;
  timestamp: string;
}

/** 任务执行日志增量帧（task_log） */
export interface TaskLogPayload {
  offset: number;
  content: string;
  finished: boolean;
}

/** 通知推送载荷（push_message；message_type 语义见 message/notifications） */
export interface PushMessagePayload {
  message_type?: string;
  title?: string;
  message?: string;
  level?: { value?: string };
  notice_type?: { value?: number; label?: string };
  pk?: string | number;
  [key: string]: unknown;
}

/** 聊天泡载荷（chat_message；服务端回填 pk/username 后广播） */
export interface ChatMessagePayload {
  text?: string;
  pk?: string | number;
  username?: string;
  userinfo?: { username?: string };
  [key: string]: unknown;
}

/** 当前登录用户信息帧（userinfo） */
export interface UserinfoPayload {
  pk?: string | number;
  userinfo?: { username?: string };
  [key: string]: unknown;
}

/** 入站/出站帧类型守卫：raw.action === action 时收窄为 OutboundMessage<T> */
export function isOutboundMessage<T = unknown>(
  raw: unknown,
  action: MessageActionValue
): raw is OutboundMessage<T> {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { action?: unknown }).action === action
  );
}
