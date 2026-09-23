import { BaseApi, ViewBaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";
import { postSse, type SseFrame } from "@/utils/sse";

/** AI 使用/二开助手 */
export type AiStatus = {
  enabled: boolean;
  configured: boolean;
  chunks: number;
  synced_at: string;
  /** A2 受限动作：灰度开启且当前用户有可用动作时为 true */
  action_enabled?: boolean;
  actions?: { key: string; label: string }[];
};

/** A2 受限动作草稿（LLM 产出、服务端校验后的结构，执行前需用户确认） */
export type AiActionDraft = {
  action: string;
  label: string;
  params: Record<string, unknown>;
  summary: string;
  requires_approval: boolean;
};

export type AiSource = { title: string; path: string; chunk_index: number };

export type AiAskResult = { answer: string; sources: AiSource[] };

/** 助手页（左右分栏）三入口标识：文档问答 / 数据查询 / 指令执行 */
export type AiConsoleFeature = "docs" | "nl" | "action";

/** 服务端持久化的助手消息（AiChatMessage；历史与流式 done 共用同一份契约） */
export type AiConsoleMessage = {
  id: number;
  feature: AiConsoleFeature;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning: string;
  extra: {
    /** 文档问答引用出处 */
    sources?: AiSource[];
    /** NL 查询解释结果（草稿卡片） */
    nl?: NlInterpretResult;
    /** NL 查询运行结果（明细表 / 聚合序列） */
    nl_run?: {
      columns?: string[];
      rows?: Record<string, unknown>[];
      series?: { name: string; value: number }[];
      total?: number;
    };
    /** 受限动作草稿（确认卡片；单动作契约） */
    action_draft?: AiActionDraft;
    /** 受限动作草稿数组（多步串联，一次对话多个动作逐项确认） */
    action_drafts?: AiActionDraft[];
    /** 动作执行结果 */
    action_result?: Record<string, unknown>;
    /** 流中断标记（部分内容保留的原因） */
    partial?: string;
    /** 系统级错误消息 */
    error?: boolean;
    no_answer?: boolean;
  };
  created_time: string;
};

/** 统一工具目录条目（MCP tools/list 等价：标准化能力描述） */
export type AiToolItem = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
};

export type AiToolsResult = { action_enabled: boolean; tools: AiToolItem[] };

/** B1 调用观测：近 N 天聚合（数据源 OperationLog auth_type=ai） */
export type AiMetrics = {
  days: number;
  total: number;
  success: number;
  failed: number;
  by_module: { module: string; label: string; count: number }[];
  by_day: { date: string; module: string; count: number }[];
  top_users: { username: string; count: number }[];
  tokens: { prompt: number; completion: number; total: number };
};

export type NlQueryDsl = {
  dataset: string;
  mode: "rows" | "aggregate";
  filters: { field: string; op: string; value: unknown }[];
  limit: number;
  group_by?: string;
  metric?: string;
  date_trunc?: string;
  value_field?: string;
};

export type NlInterpretResult = {
  dsl: NlQueryDsl;
  dataset_name: string;
  preview_count: number;
  mode: string;
};

export const aiConfigApi = new ViewBaseApi("/api/system/ai/assistant/config");

/**
 * AI 流式事件回调（服务端统一契约：meta → reasoning* → delta* → done | error）。
 *
 * - `onReasoning`：思考型模型的思考增量（实时上屏）；
 * - `onDelta`：正式回答增量；
 * - `onError`：流内失败（响应头已发出，带下发光；门禁类错误由 postSse 抛 SseError）。
 */
export interface AiStreamEvents<TDone> {
  onMeta?: (data: Record<string, unknown>) => void;
  onReasoning?: (delta: string) => void;
  onDelta?: (delta: string) => void;
  onDone?: (data: TDone) => void;
  onError?: (data: { detail: string }) => void;
}

/** 通用 AI 流式请求：POST + SSE 逐帧分发（助手页文档问答 / NL 查数解释共用）。 */
function streamRequest<TDone>(
  url: string,
  body: unknown,
  events: AiStreamEvents<TDone>,
  signal?: AbortSignal
): Promise<void> {
  return postSse(url, body, {
    signal,
    onFrame: (frame: SseFrame) => {
      let payload: unknown = {};
      try {
        payload = frame.data ? JSON.parse(frame.data) : {};
      } catch {
        return;
      }
      if (frame.event === "meta") {
        events.onMeta?.(payload as Record<string, unknown>);
      } else if (frame.event === "reasoning") {
        events.onReasoning?.(
          String((payload as { delta?: unknown }).delta ?? "")
        );
      } else if (frame.event === "delta") {
        events.onDelta?.(String((payload as { delta?: unknown }).delta ?? ""));
      } else if (frame.event === "done") {
        events.onDone?.(payload as TDone);
      } else if (frame.event === "error") {
        events.onError?.(payload as { detail: string });
      }
    }
  });
}

/** AI 配置档案：多套凭据 + 采样/行为参数，激活唯一 */
export type AiProfileItem = {
  pk: string;
  name: string;
  base_url: string;
  api_key_set: boolean;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  stop: string;
  seed: number | null;
  timeout: number;
  max_retries: number;
  context_limit: number;
  persona: string;
  /** 用途（AI-1 档案分流）：chat 供问答/聊天，structured 供 NL 查数/动作草稿 */
  purpose?: "chat" | "structured";
  /** 能力画像（AI-1 探测结果，可人工修正） */
  capabilities?: Record<string, { ok?: boolean; detail?: string } | undefined>;
  probed_at?: string | null;
  is_active: boolean;
  remark: string;
  updated_time: string;
  created_time: string;
};

/** AI 用量账本汇总（AI-5） */
export type AiUsageSummary = {
  days: number;
  total_calls: number;
  total_tokens: number;
  failed: number;
  by_day: { day: string; calls: number; tokens: number }[];
  by_feature: { feature: string; calls: number; tokens: number }[];
  /** AI-2 双轨对照：动作草稿链路按轨道（native / prompt）的成功率统计 */
  by_track: {
    track: string;
    calls: number;
    failed: number;
    tokens: number;
    success_rate: number;
  }[];
  top_users: { username: string; calls: number; tokens: number }[];
  quota: {
    daily_calls: number;
    daily_tokens: number;
    concurrent_streams: number;
  };
  stream_slots: number;
};

class AiProfileApi extends BaseApi {
  /** 激活档案（全局至多一个，供全部 AI 功能使用） */
  activate = (pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/activate`
    );
  };
  /** 停用档案（回落 Setting 历史配置） */
  deactivate = (pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/deactivate`
    );
  };
  /** 按档案持久化值真实 ping 一次 LLM */
  test = (pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/test`
    );
  };
  /** AI-1 能力探测：JSON / 原生工具调用 / 思考内容（可选多模态），结果落档案画像 */
  probe = (
    pk: string,
    data?: { capabilities?: string[]; vision?: boolean }
  ) => {
    return this.request<Record<string, { ok?: boolean } | undefined>>(
      "post",
      {},
      data ?? {},
      `${this.baseApi}/${pk}/probe`
    );
  };
}

export const aiProfileApi = new AiProfileApi("/api/system/ai/profiles");

export const listAiProfileRows = <T>(body: unknown): T[] =>
  (((body as { data?: { results?: T[] } })?.data?.results ?? []) as T[]) || [];

class AiAssistantApi extends BaseApi {
  status = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/status`);
  };
  /** B1 观测：近 N 天用量 / 成功率 / 趋势 / 类型分布 / Top 用户 */
  metrics = (days = 30) => {
    return this.request<DetailResult>(
      "get",
      { days },
      {},
      `${this.baseApi}/metrics`
    );
  };
  /** AI-5 用量账本：按天 / 按链路 / Top 用户 + 配额配置 */
  usage = (days = 7, feature = "") => {
    return this.request<DetailResult<AiUsageSummary>>(
      "get",
      { days, feature },
      {},
      `${this.baseApi}/usage`
    );
  };
  /** 文档问答（非流式；流式请用 askStream） */
  ask = (question: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { question },
      `${this.baseApi}/ask`
    );
  };
  /** 文档问答（流式）：思考增量 + 回答增量实时上屏，done 带 answer/sources/message */
  askStream = (
    question: string,
    events: AiStreamEvents<{
      answer: string;
      sources: AiSource[];
      message?: AiConsoleMessage;
    }>,
    signal?: AbortSignal
  ) => {
    return streamRequest<{
      answer: string;
      sources: AiSource[];
      message?: AiConsoleMessage;
    }>(
      `${import.meta.env.VITE_API_DOMAIN ?? ""}${this.baseApi}/ask/stream`,
      { question },
      events,
      signal
    );
  };
  /** NL 查数解释（流式）：思考流实时展示，done 带 dsl/试算预览/持久化消息 */
  nlInterpretStream = (
    question: string,
    events: AiStreamEvents<NlInterpretResult & { message?: AiConsoleMessage }>,
    signal?: AbortSignal
  ) => {
    return streamRequest<NlInterpretResult & { message?: AiConsoleMessage }>(
      `${import.meta.env.VITE_API_DOMAIN ?? ""}${this.baseApi}/nl-query/interpret/stream`,
      { question },
      events,
      signal
    );
  };
  /** NL 查数：NL → DSL + 试算预览 */
  nlInterpret = (question: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      { question },
      `${this.baseApi}/nl-query/interpret`
    );
  };
  /** NL 查数：执行试算确认后的 DSL（服务端重校验 + 审计） */
  nlRun = (dsl: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      { dsl },
      `${this.baseApi}/nl-query/run`
    );
  };
  /** 助手页对话历史（按入口分页，时间正序；before_id 向上翻页） */
  history = (params: {
    feature: AiConsoleFeature;
    before_id?: number;
    limit?: number;
  }) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/history`
    );
  };
  /** 统一工具目录（MCP tools/list 等价：当前用户可执行的全部系统动作） */
  tools = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/tools`);
  };
  /** 指令执行草稿（流式）：思考增量 + done 带 drafts（多步串联）/ draft（单动作兜底）/ 澄清消息 */
  actionInterpretStream = (
    message: string,
    events: AiStreamEvents<{
      kind: "draft" | "message";
      draft?: AiActionDraft;
      drafts?: AiActionDraft[];
      message?: AiConsoleMessage;
    }>,
    signal?: AbortSignal
  ) => {
    return streamRequest<{
      kind: "draft" | "message";
      draft?: AiActionDraft;
      drafts?: AiActionDraft[];
      message?: AiConsoleMessage;
    }>(
      `${import.meta.env.VITE_API_DOMAIN ?? ""}${this.baseApi}/action/interpret/stream`,
      { message },
      events,
      signal
    );
  };
  /**
   * A2 受限动作：执行确认后的草稿（以当前用户身份执行，服务端重校验 + 审计）。
   * 需审批的动作首次调用返回 412 + approval_required：令牌由 http 拦截器暂存，
   * 审批通过后原样重发即自动携带 X-Approval-Id。
   */
  actionExecute = (payload: {
    action: string;
    params: Record<string, unknown>;
    room_id?: number;
    message_id?: number;
  }) => {
    return this.request<DetailResult>(
      "post",
      {},
      payload,
      `${this.baseApi}/action/execute`
    );
  };
}

export const aiAssistantApi = new AiAssistantApi("/api/system/ai/assistant");
