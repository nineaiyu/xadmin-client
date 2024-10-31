import type { DetailResult } from "@/api/types";
import { BaseRequest } from "@/api/base";
import type { DataListResult } from "@/api/types";

export class SystemMsgSubscriptionApi extends BaseRequest {
  backends = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `/api/notifications/backends`
    );
  };

  list = (params?: object) => {
    return this.request<DetailResult>("get", params, {});
  };

  update = (pk: number | string, data?: object) => {
    return this.request<DetailResult>("put", {}, data, `${this.baseApi}/${pk}`);
  };
  partialUpdate = (pk: number | string, data?: object) => {
    return this.request<DetailResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/${pk}`
    );
  };
}

export const systemMsgSubscriptionApi = new SystemMsgSubscriptionApi(
  "/api/notifications/system-msg-subscription"
);
