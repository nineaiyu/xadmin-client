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
  last_failure: string;
};

export type WebhookDeliveryItem = {
  pk: string;
  subscription: string;
  subscription_name: string;
  event: string;
  status: "pending" | "success" | "failed" | "exhausted";
  attempt: number;
  response_code: number | null;
  response_body: string;
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
  "/api/system/webhooks/subscriptions"
);
export const webhookDeliveryApi = new WebhookDeliveryApi(
  "/api/system/webhooks/deliveries"
);

export const listWebhookRows = <T>(body: unknown): T[] =>
  (((body as { data?: { results?: T[] } })?.data?.results ?? []) as T[]) || [];
