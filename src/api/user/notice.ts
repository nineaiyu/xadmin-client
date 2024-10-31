import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult } from "@/api/types";

class UserNoticeReadApi extends BaseApi {
  unread = (params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/unread`
    );
  };
  allRead = (params?: object) => {
    return this.request<BaseResult>(
      "patch",
      params,
      {},
      `${this.baseApi}/all-read`
    );
  };
  batchRead = (data?: object) => {
    return this.request<BaseResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/batch-read`
    );
  };
}

export const userNoticeReadApi = new UserNoticeReadApi(
  "/api/notifications/site-messages"
);
