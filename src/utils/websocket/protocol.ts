import type {
  MonitorCelery,
  MonitorHealth,
  MonitorLive,
  MonitorOverview,
  MonitorRedisInfo,
  MonitorServices,
  MonitorSlow
} from "@/api/system/monitor";
import type {
  Action as WsContractAction,
  InboundFrame as WsContractInboundFrame,
  OutboundFrame as WsContractOutboundFrame
} from "@/api/types/ws-frame";

/**
 * WebSocket 消息协议类型（与 server message/protocol.py 对齐）。
 *
 * 上行/下行帧均为 JSON：
 * ```json
 * { "action": "chat_message", "data": {...}, "mid": "可选", "v": 1 }
 * ```
 * 出站帧额外含 code / detail / timestamp（服务端 send_base_json）。
 * 新增 action：在 MessageAction 登记 + 补对应 Payload 接口。
 *
 * 帧壳与动作枚举以生成契约 `@/api/types/ws-frame` 为准（服务端 message/protocol.py
 * 是唯一真源，`pnpm gen:metadata-types` 生成；本地常量经 `satisfies` 对账，
 * 登记了契约外的动作即 typecheck 报错）。
 */

/** 协议版本，与服务端 PROTOCOL_VERSION 对齐 */
export const WS_PROTOCOL_VERSION = 1;

/**
 * 剥离生成契约的索引签名：服务端 send_base_json 允许追加顶层键（契约不封闭），
 * 客户端按声明键消费更严格；这里只保留契约显式声明的帧壳字段。
 */
type ContractFrameKeys<T> = {
  [
    K in keyof T as string extends K ? never : number extends K ? never : K
  ]: T[K];
};

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
  /** 消息表情回应（双向，ws/chat/） */
  CHAT_REACTION: "chat_reaction",
  /** 已读回执（上行 chat_read → 下行最新游标） */
  CHAT_READ: "chat_read",
  /** 未读红点推送（下行，ws/chat/） */
  CHAT_UNREAD: "chat_unread",
  /** 任务执行日志增量推送 */
  TASK_LOG: "task_log",
  /** 监控面板指标推送（system/ws_monitor.py） */
  MONITOR: "monitor",
  /** 大屏远程控制指令（system/ws_screen.py，展示端被动接收） */
  SCREEN_COMMAND: "screen_command",
  /** 大屏服务端聚合数据推送（dataset/ws_screen.py，按观察者各自聚合后自推） */
  SCREEN_DATA: "screen_data"
  // 值形态由生成契约约束（未知动作字面量即类型错误）；
  // 双向集合一致性由 protocol.spec.ts 对着镜像 schema 断言（新增 action 必须双端登记）
} as const satisfies Record<string, WsContractAction>;

export type MessageActionValue =
  (typeof MessageAction)[keyof typeof MessageAction];

/** 客户端→服务端帧（帧壳来自生成契约；data 泛型化以便按 action 收窄载荷） */
export interface InboundMessage<T = unknown> extends Omit<
  ContractFrameKeys<WsContractInboundFrame>,
  "action" | "data"
> {
  action: MessageActionValue;
  data?: T;
}

/** 服务端→客户端帧（帧壳来自生成契约：code/detail/timestamp/v 均由契约声明） */
export interface OutboundMessage<T = unknown> extends Omit<
  ContractFrameKeys<WsContractOutboundFrame>,
  "action" | "data"
> {
  action: MessageActionValue;
  data?: T;
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

/** 大屏聚合数据帧（screen_data；ws/screen/<pk> 下行，按观察者权限各自聚合后自推）。
 *
 * 服务端不做组广播数据：execute/aggregate 的数据权限绑定浏览者，触发事件到达各展示
 * 连接后以连接自身用户视角聚合，再只发给自己——权限语义与旧「客户端逐卡 HTTP 重拉」
 * 等价，M 卡 × N 观察者的 HTTP 请求收敛为每观察者每轮 1 帧。
 * canvas（layout 非空）单帧 dashboard=null；carousel（layout 空）逐 dashboards 各一帧。
 * cards[].data 为 execute/aggregate 的返回结构；单卡失败进 errors，不中断整帧。 */
export interface ScreenDataPayload {
  screen: string;
  dashboard: string | null;
  rev: number;
  cards: Array<{ card: string; kind: string; data: unknown }>;
  errors: Array<{ card: string; detail: string }>;
  /** 广播时刻（epoch 秒），可据此丢弃乱序到达的旧帧 */
  ts: number;
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
  /** text/ai/system 为文本类；image/video/audio/file 为附件消息（附件信息见 extra.file） */
  message_type: "text" | "ai" | "system" | "image" | "video" | "audio" | "file";
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
    /** 附件（图片/音视频/文件消息）的渲染信息（类型定义见 src/api/chat） */
    file?: import("@/api/chat").ChatAttachment;
    /** 表情回应表（emoji → 回应用户 pk 列表，全量下发整体替换） */
    reactions?: Record<string, number[]>;
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

/** 表情回应上行帧（chat_reaction）：对某条消息添加 / 移除自己的 emoji 回应。
 * add 幂等；remove 只能移除自己的回应。消息不存在 / 已撤回 / 非房间成员 /
 * 机器消息时服务端静默忽略；emoji 超长或回应数超上限时回执 code=1001。 */
export interface ChatReactionPayload {
  /** 目标消息 pk（ChatMessage 自增主键） */
  message: number;
  /** 回应表情（去首尾空白后 1-16 字符） */
  emoji: string;
  /** add 添加 / remove 移除 */
  op: "add" | "remove";
}

/** 表情回应广播帧（chat_reaction 下行）：reactions 为该消息**全量**回应表
 * （emoji → 回应用户 pk 列表），客户端整体替换本地状态（幂等，无需自行合并）；
 * ts 为广播时刻（epoch 秒），可据此丢弃乱序到达的旧帧。 */
export interface ChatReactionUpdatePayload {
  room: number;
  message: number;
  reactions: Record<string, number[]>;
  ts: number;
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
