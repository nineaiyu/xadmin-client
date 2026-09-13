import { BaseApi, ViewBaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** AI 使用/二开助手（ADR-023） */
export type AiStatus = {
  enabled: boolean;
  configured: boolean;
  chunks: number;
  synced_at: string;
};

export type AiSource = { title: string; path: string; chunk_index: number };

export type AiAskResult = { answer: string; sources: AiSource[] };

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

class AiAssistantApi extends BaseApi {
  status = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/status`);
  };
  ask = (question: string) => {
    return this.request<DetailResult>("post", {}, { question });
  };
  /** NL 查数：NL → DSL + 试算预览（ADR-024） */
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
}

export const aiAssistantApi = new AiAssistantApi("/api/system/ai/assistant");
