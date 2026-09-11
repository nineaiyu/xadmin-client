import type { DetailResult } from "@/api/types";
import { BaseRequest } from "@/api/base";
import type { DataListResult } from "@/api/types";

export class SystemMsgSubscriptionApi extends BaseRequest {
  backends = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `${this.baseApi}/backends`
    );
  };

  list = (params?: object) => {
    return this.request<DetailResult>("get", params, {});
  };

  update = (pk: number | string, data?: object) => {
    return this.request<DetailResult>("put", {}, data, `${this.baseApi}/${pk}`);
  };

  /** 发送测试消息（渠道连通性自检：系统订阅发超管，个人订阅发自己） */
  testMsg = (data: { message_type: string }) => {
    return this.request<DetailResult>("post", {}, data, `${this.baseApi}/test`);
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
