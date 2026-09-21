import type {
  MonitorCelery,
  MonitorHealth,
  MonitorLive,
  MonitorOverview,
  MonitorRedisInfo,
  MonitorServices,
  MonitorSlow
} from "@/api/system/monitor";

/**
 * WebSocket 消息协议类型（与 server message/protocol.py 对齐）。
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

/**
 * 消息动作（字符串常量，与服务端 MessageAction 一致）
 *
 * `CHAT_MESSAGE` 在两条通道上载荷不同（历史原因）：
 * - `/ws/message/{group}/{username}`（MessageNotify，仅兼容保留）→ ChatMessagePayload；
 * - `/ws/chat/`（ChatNotify，聊天室页面）→ ChatRoomMessage。
 */
export const MessageAction = {
  /** 心跳：上行 ping → 下行 data='pong' */
  PING: "ping",
  /** 请求/推送当前登录用户信息 */
  USERINFO: "userinfo",
  /** 站内信/通知推送 */
  PUSH_MESSAGE: "push_message",
  /** 聊天室消息（双向） */
  CHAT_MESSAGE: "chat_message",
  /** 消息撤回（双向，ws/chat/） */
  CHAT_RECALL: "chat_recall",
  /** 已读回执（上行 chat_read → 下行最新游标） */
  CHAT_READ: "chat_read",
  /** 未读红点推送（下行，ws/chat/） */
  CHAT_UNREAD: "chat_unread",
  /** 任务执行日志增量推送 */
  TASK_LOG: "task_log",
  /** 监控面板指标推送（system/ws_monitor.py） */
  MONITOR: "monitor",
  /** 大屏远程控制指令（system/ws_screen.py，展示端被动接收） */
  SCREEN_COMMAND: "screen_command"
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

/** 监控指标推送帧（monitor；section 区分 live 高频 / panel 低频，与 ws_monitor.py 对齐）。
 * 载荷类型复用监控 API 的强类型定义，保证 WS 与 HTTP 两路数据形状一致 */
export interface MonitorPushPayload {
  section: "live" | "panel";
  live?: MonitorLive;
  services?: MonitorServices;
  redis?: MonitorRedisInfo;
  celery?: MonitorCelery;
  slow?: MonitorSlow;
  trend?: MonitorOverview["trend"];
  health?: MonitorHealth;
}

/** 大屏远程控制帧（screen_command；ws/screen/<pk> 下行，与 system/ws_screen.py 对齐）
 *
 * command=state 为连接回放（对齐最近一次控制态），其余为管理端下发的指令；
 * mode=manual 时展示端停轮播并停在 index 页，refresh_rev 递增表示需重拉数据。 */
export interface ScreenCommandPayload {
  command: "switch" | "page" | "refresh" | "auto" | "state";
  mode?: "auto" | "manual";
  index?: number;
  refresh_rev?: number;
  rev?: number;
  ts?: string;
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

/** 历史聊天通道（ws/message/*）气泡载荷；服务端回填 pk/username 后广播 */
export interface ChatMessagePayload {
  text?: string;
  pk?: string | number;
  username?: string;
  userinfo?: { username?: string };
  [key: string]: unknown;
}

/** 聊天室消息（ChatRoomMessage，与 src/api/chat 的 ChatMessageItem 同形状） */
export interface ChatRoomMessage {
  id: number;
  room_id: number;
  room_type: string;
  sender_pk: number | null;
  sender_name: string;
  sender_avatar: string;
  message_type: "text" | "ai" | "system";
  content: string;
  created_time: string;
  client_msg_id: string;
  extra: {
    mode?: "chat" | "kb" | "action";
    sources?: Array<{ title: string; path: string; chunk_index: number }>;
    error?: boolean;
    /** 思考过程（思考型模型的 reasoning_content，落库供回看） */
    reasoning?: string;
    /** 模型只产出思考、未给出最终回答（内容为可读提示文案） */
    no_answer?: boolean;
  };
  is_recalled?: boolean;
  can_recall?: boolean;
}

/** 消息撤回帧（chat_recall） */
export interface ChatRecallPayload {
  message_id: number;
  id?: number;
  room_id: number;
  operator_pk?: number;
}

/** 已读回执帧（chat_read） */
export interface ChatReadPayload {
  room_id: number;
  last_read_id: number;
}

/** 未读红点帧（chat_unread） */
export interface ChatUnreadPayload {
  room_id: number;
  unread_count: number;
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
