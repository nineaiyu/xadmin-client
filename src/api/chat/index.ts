import { BaseRequest } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";
import { postSse, type SseFrame } from "@/utils/sse";

/**
 * 聊天室 REST（服务端 message/views.py）。
 *
 * WS 负责实时收发（src/utils/websocket.ts::ChatWebSocket），REST 负责
 * 会话列表 / 历史分页 / 私聊开通 / 撤回 / 联系人 / AI 提问（含 SSE 流式）。
 */

/** 会话对端 / 联系人用户简介 */
export interface ChatPeer {
  pk: number;
  username: string;
  nickname?: string;
  avatar?: string;
  online?: boolean;
  last_active?: string;
}

/** 会话（公共聊天室 / 私聊 / AI 助手） */
export interface ChatRoomItem {
  id: number;
  room_type: "public" | "private" | "ai";
  room_key: string;
  name: string;
  peer: ChatPeer | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

/** 消息（与 WS 广播载荷同形状，见 utils/websocket/protocol.ts::ChatRoomMessage） */
export interface ChatMessageItem {
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
    /** A2 受限动作草稿（AI 消息携带，确认后执行） */
    action_draft?: {
      action: string;
      label: string;
      params: Record<string, unknown>;
      summary: string;
      requires_approval: boolean;
    };
    action_result?: Record<string, unknown>;
  };
  is_recalled?: boolean;
  can_recall?: boolean;
  /** 前端本地态（乐观上屏 / 发送失败标记），非服务端字段 */
  sending?: boolean;
  failed?: boolean;
}

export interface ChatRoomListResult {
  rooms: ChatRoomItem[];
  ai_enabled: boolean;
  /** `/kb` 命令前缀（后端下发，前端拼提示文案） */
  ai_command: string;
  ai_hint: string;
}

export interface ChatHistoryResult {
  results: ChatMessageItem[];
  has_more: boolean;
  room: ChatRoomItem;
}

export interface ChatContactResult {
  results: ChatPeer[];
}

export interface ChatAiMessageResult {
  mode: "chat" | "kb";
  question: ChatMessageItem;
  message: ChatMessageItem;
}

class ChatApi extends BaseRequest {
  /** 我的会话列表（公共聊天室置顶 + AI 助手 + 私聊） */
  roomList = () => {
    return this.request<DetailResult<ChatRoomListResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/room`
    );
  };
  /** 开通（或复用）与目标用户的一对一私聊 */
  openPrivate = (userPk: number) => {
    return this.request<DetailResult<ChatRoomItem>>(
      "post",
      {},
      { user_pk: userPk },
      `${this.baseApi}/room/open-private`
    );
  };
  /** 历史消息（倒序游标拉取，响应内按时间正序） */
  history = (params: { room: number; before_id?: number; limit?: number }) => {
    return this.request<DetailResult<ChatHistoryResult>>(
      "get",
      params,
      {},
      `${this.baseApi}/message`
    );
  };
  /** 撤回消息（仅本人、2 分钟内） */
  recall = (id: number) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/message/${id}/recall`
    );
  };
  /** 最近在线联系人 */
  contacts = (params?: { limit?: number }) => {
    return this.request<DetailResult<ChatContactResult>>(
      "get",
      params,
      {},
      `${this.baseApi}/contacts`
    );
  };
  /** AI 助手提问（`/kb` 前缀走知识库问答） */
  aiMessage = (data: {
    room_id?: number;
    content: string;
    client_msg_id?: string;
  }) => {
    return this.request<DetailResult<ChatAiMessageResult>>(
      "post",
      {},
      data,
      `${this.baseApi}/ai/message`
    );
  };
}

export interface ChatAiStreamEvents {
  /** meta：问题回执（服务端落库后的正式载荷） */
  onMeta?: (data: { question: ChatMessageItem }) => void;
  /** delta：文本增量 */
  onDelta?: (delta: string) => void;
  /** done：AI 回复落库后的正式载荷（mode/message），此刻流结束 */
  onDone?: (data: { mode: string; message: ChatMessageItem }) => void;
  /** error：AI 全程失败（message 为 system 降级消息，detail 为可读原因） */
  onError?: (data: { detail: string; message: ChatMessageItem }) => void;
}

/**
 * AI 流式提问（SSE，二期）：POST /api/chat/ai/stream。
 *
 * 服务端事件序 meta → delta* → done | error；响应头已发出后无法再改状态码，
 * 所以失败通过 error 带内下发光，非 SSE 错误（门禁/参数）由 postSse 抛 SseError。
 */
export function streamAiMessage(
  data: { room_id?: number; content: string; client_msg_id?: string },
  events: ChatAiStreamEvents,
  signal?: AbortSignal
): Promise<void> {
  return postSse(
    `${import.meta.env.VITE_API_DOMAIN ?? ""}/api/chat/ai/stream`,
    data,
    {
      signal,
      onFrame: (frame: SseFrame) => {
        let payload: unknown = {};
        try {
          payload = frame.data ? JSON.parse(frame.data) : {};
        } catch {
          return;
        }
        if (frame.event === "meta") {
          events.onMeta?.(payload as { question: ChatMessageItem });
        } else if (frame.event === "delta") {
          events.onDelta?.(
            String((payload as { delta?: unknown }).delta ?? "")
          );
        } else if (frame.event === "done") {
          events.onDone?.(
            payload as { mode: string; message: ChatMessageItem }
          );
        } else if (frame.event === "error") {
          events.onError?.(
            payload as { detail: string; message: ChatMessageItem }
          );
        }
      }
    }
  );
}

export const chatApi = new ChatApi("/api/chat");
