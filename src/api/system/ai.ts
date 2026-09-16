import { BaseApi, ViewBaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

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

/** B1 调用观测：近 N 天聚合（数据源 OperationLog auth_type=ai） */
export type AiMetrics = {
  days: number;
  total: number;
  success: number;
  failed: number;
  by_module: { module: string; label: string; count: number }[];
  by_day: { date: string; module: string; count: number }[];
  top_users: { username: string; count: number }[];
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
  is_active: boolean;
  remark: string;
  updated_time: string;
  created_time: string;
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
  ask = (question: string) => {
    return this.request<DetailResult>("post", {}, { question });
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
