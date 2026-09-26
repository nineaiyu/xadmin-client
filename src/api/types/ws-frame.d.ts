// 接口契约类型：由 contract/schema/*.schema.json 生成。
// 该目录镜像自 xadmin-server/docs/schema（服务端为契约源）；禁止手改。
// 重新生成：pnpm gen:metadata-types；Schema 变更属破坏性契约变更，需与后端一同评审。

/**
 * WebSocket 消息协议 v1 帧（message/protocol.py ↔ client src/utils/websocket/protocol.ts）。上行帧仅需 action；出站帧由 send_base_json 统一携带 code/detail/timestamp/v。新增 action 必须：① 双端 MessageAction 同步登记；② 补对应 payload 定义（可在此追加 definitions 并接入 tests/unit/message/test_protocol.py）。服务端由 tests/unit/common/test_contract_schemas.py 持续校验。
 */
export type WebSocketFrameV1 = InboundFrame | OutboundFrame;
/**
 * 消息动作枚举（MessageAction）
 */
export type Action =
  | "ping"
  | "userinfo"
  | "push_message"
  | "chat_message"
  | "chat_recall"
  | "chat_read"
  | "chat_unread"
  | "task_log"
  | "monitor"
  | "screen_command";

/**
 * 客户端 → 服务端帧（客户端受控，键集合封闭）
 */
export interface InboundFrame {
  action: Action;
  /**
   * 载荷，由具体 action 决定
   */
  data?: {
    [k: string]: unknown;
  };
  /**
   * 客户端回显一致性标记
   */
  mid?: string;
  v?: 1;
}
/**
 * 服务端 → 客户端帧；服务端可经 send_base_json kwargs 追加顶层键，故不封闭 additionalProperties
 */
export interface OutboundFrame {
  /**
   * 业务码，语义同 ApiResponse.code
   */
  code: number;
  action: Action;
  detail: string;
  timestamp: string;
  /**
   * 载荷，由具体 action 决定
   */
  data?: {
    [k: string]: unknown;
  };
  mid?: string;
  v: 1;
  [k: string]: unknown;
}
