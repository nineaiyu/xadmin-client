import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 出站 Webhook：订阅与投递审计 */
export type WebhookSubscriptionItem = {
  pk: string;
  name: string;
  url: string;
  events: string[];
  description: string;
  is_active: boolean;
  has_secret: boolean;
  last_failure: string;
};

export type WebhookDeliveryStatus =
  "pending" | "success" | "failed" | "exhausted";

export type WebhookDeliveryItem = {
  pk: string;
  subscription: string;
  subscription_name: string;
  event: string;
  /** 状态：后端 LabeledChoiceField 输出 {value,label}（字典接入后带 color） */
  status:
    | WebhookDeliveryStatus
    | { value: WebhookDeliveryStatus; label?: string; color?: string | null };
  attempt: number;
  response_code: number | null;
  response_body: string;
  /** 响应体超过审计存储上限（8KB）被截断 */
  response_body_truncated?: boolean;
  payload?: Record<string, unknown>;
  request_headers?: Record<string, string>;
  duration: number | null;
  next_retry_at: string | null;
  created_time: string;
};

export type WebhookEvent = { key: string; label: string };

class WebhookSubscriptionApi extends BaseApi {
  events = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/events`);
  };
  test = (pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/test`
    );
  };
  /** 轮换密钥：明文仅在本次响应返回一次 */
  rotateSecret = (pk: string) => {
    return this.request<DetailResult<{ secret: string }>>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/rotate-secret`
    );
  };
}

class WebhookDeliveryApi extends BaseApi {
  retry = (pk: string) => {
    return this.request<DetailResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/retry`
    );
  };
}

export const webhookSubscriptionApi = new WebhookSubscriptionApi(
  "/api/task/webhooks/subscriptions"
);
export const webhookDeliveryApi = new WebhookDeliveryApi(
  "/api/task/webhooks/deliveries"
);

export const listWebhookRows = <T>(body: unknown): T[] =>
  (((body as { data?: { results?: T[] } })?.data?.results ?? []) as T[]) || [];
