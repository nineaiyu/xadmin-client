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
      "put",
      params,
      {},
      `${this.baseApi}/read-all`
    );
  };
  batchRead = (data?: object) => {
    return this.request<BaseResult>("put", {}, data, `${this.baseApi}/read`);
  };
}

export const userNoticeReadApi = new UserNoticeReadApi(
  "/api/system/user/notice"
);
