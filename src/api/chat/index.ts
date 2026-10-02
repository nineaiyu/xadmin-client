import { BaseRequest } from "@/api/base";
import type { BaseResult, DataListResult, DetailResult } from "@/api/types";
import { http } from "@/utils/http";
import type { PureHttpRequestConfig } from "@/utils/http/types";
import { postSse, type SseFrame } from "@/utils/sse";

/**
 * 聊天室 REST（服务端 message/views.py）。
 *
 * WS 负责实时收发（src/utils/websocket.ts::ChatWebSocket），REST 负责
 * 会话列表 / 历史分页 / 私聊开通 / 撤回 / 联系人 / 群聊管理 / AI 提问（含 SSE 流式）。
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

/** 群成员候选（选人控件：仅 pk/用户名/昵称） */
export interface ChatUserOption {
  pk: number;
  username: string;
  nickname?: string;
}

/** 会话（公共聊天室 / 私聊 / AI 助手 / 群聊） */
export interface ChatRoomItem {
  id: number;
  room_type: "public" | "private" | "ai" | "group";
  room_key: string;
  name: string;
  peer: ChatPeer | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  /** 群主主键（服务端对所有会话下发，非群聊为空） */
  owner_pk?: number | null;
  /** 群成员总数（群聊下发） */
  member_count?: number;
  /** 群成员预览（前 12 人，群聊下发） */
  members?: ChatPeer[];
  /** 当前用户是否为群主（群聊下发） */
  is_owner?: boolean;
}

/** 附件（图片 / 文件消息）：取件地址由服务端按消息主键派生（受鉴权） */
export interface ChatAttachment {
  pk: string;
  filename: string;
  filesize: number;
  mime_type: string;
  category: string;
  /** image 与在线预览判定同口径；video/audio 与上传分类同口径（音视频消息）；file 为附件下载语义 */
  kind: "image" | "video" | "audio" | "file";
  /** 受鉴权取件地址（图片 img / 音视频 inline / 文件下载共用；撤回或附件被清理后为空） */
  url: string;
  /** 附件记录已失效（服务端外键置空 / 消息已撤回） */
  missing: boolean;
}

/** 附件消息上传种类（与服务端 UPLOAD_KINDS 同源；file 对实际种类不限） */
export type ChatAttachmentKind = "image" | "video" | "audio" | "file";

/** 消息（与 WS 广播载荷同形状，见 utils/websocket/protocol.ts::ChatRoomMessage） */
export interface ChatMessageItem {
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
    /** A2 受限动作草稿（AI 消息携带，确认后执行；单动作契约） */
    action_draft?: {
      action: string;
      label: string;
      params: Record<string, unknown>;
      summary: string;
      requires_approval: boolean;
    };
    /** 受限动作草稿数组（多步串联，一次对话多个动作逐项确认） */
    action_drafts?: Array<{
      action: string;
      label: string;
      params: Record<string, unknown>;
      summary: string;
      requires_approval: boolean;
    }>;
    action_result?: Record<string, unknown>;
    /** 附件消息（image/video/audio/file）的渲染信息：受鉴权取件地址 + 失效标记 */
    file?: ChatAttachment;
    /** 表情回应表（emoji → 回应用户 pk 列表，全量下发整体替换；历史消息与广播载荷一致） */
    reactions?: Record<string, number[]>;
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

export interface ChatGroupMembersResult {
  room: ChatRoomItem;
  /** 完整成员列表（非预览） */
  members: ChatPeer[];
}

export interface ChatLeaveResult {
  room_id: number;
  /** 解散后为 false（最后一人退出） */
  is_active: boolean;
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
  /** 创建多人群聊（创建者为群主；成员至少 1 人且不含自己） */
  createGroup = (data: { name: string; member_pks: number[] }) => {
    return this.request<DetailResult<ChatRoomItem>>(
      "post",
      {},
      data,
      `${this.baseApi}/room/create-group`
    );
  };
  /** 群成员完整列表（成员可见） */
  groupMembers = (pk: number) => {
    return this.request<DetailResult<ChatGroupMembersResult>>(
      "get",
      {},
      {},
      `${this.baseApi}/room/${pk}/members`
    );
  };
  /** 群成员变更（仅群主；add/remove 至少一项） */
  updateGroupMembers = (
    pk: number,
    data: { add?: number[]; remove?: number[] }
  ) => {
    return this.request<DetailResult<ChatRoomItem>>(
      "post",
      {},
      data,
      `${this.baseApi}/room/${pk}/members`
    );
  };
  /** 修改群名（仅群主） */
  renameGroup = (pk: number, name: string) => {
    return this.request<DetailResult<ChatRoomItem>>(
      "post",
      {},
      { name },
      `${this.baseApi}/room/${pk}/rename`
    );
  };
  /** 退出群聊（群主退出自动转让；最后一人退出解散） */
  leaveGroup = (pk: number) => {
    return this.request<DetailResult<ChatLeaveResult>>(
      "post",
      {},
      {},
      `${this.baseApi}/room/${pk}/leave`
    );
  };
  /** 群成员候选：输入用户名/昵称搜索（≤20 条） */
  searchChatUsers = (keyword: string) => {
    return this.request<DataListResult<ChatUserOption>>(
      "get",
      { keyword },
      {},
      `${this.baseApi}/contacts/user-options`
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
  /**
   * 附件上传（图片 / 音视频 / 文件消息共用）：复用文件中心安全策略（扩展名/大小/配额），
   * 落库为临时件，发送消息后由服务端转正（未发送的临时件由每日清理回收）。
   * `kind` 必须与真实 MIME 判定一致（image/video/audio），不匹配返回 1001；
   * `kind=file` 对实际种类不限（图片/音视频也允许按文件消息发送）。
   */
  uploadAttachment = (
    file: File,
    kind: ChatAttachmentKind,
    config?: PureHttpRequestConfig
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    return http.upload<DetailResult<ChatAttachment>, FormData>(
      `${this.baseApi}/message/upload`,
      {},
      form,
      config
    );
  };
  /** 附件取件地址（图片 `size=thumb|preview`；文件不带参即下载，均需登录态） */
  attachmentUrl = (messageId: number, size?: "thumb" | "preview") => {
    const base = `${import.meta.env.VITE_API_DOMAIN ?? ""}/api/chat/message/${messageId}/file`;
    return size ? `${base}?size=${size}` : base;
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
  /** reasoning：思考增量（思考型模型，实时上屏到思考面板） */
  onReasoning?: (delta: string) => void;
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
 * 服务端事件序 meta → reasoning* → delta* → done | error；响应头已发出后无法
 * 再改状态码，所以失败通过 error 带内下发光，非 SSE 错误（门禁/参数）由 postSse 抛 SseError。
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
        } else if (frame.event === "reasoning") {
          events.onReasoning?.(
            String((payload as { delta?: unknown }).delta ?? "")
          );
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
