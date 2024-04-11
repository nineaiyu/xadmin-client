import { BaseApi } from "@/api/base";

class UserNoticeReadApi extends BaseApi {
  unread = (params?: object) => {
    return this.request("get", params, {}, `${this.baseApi}/unread`);
  };
  allRead = (params?: object) => {
    return this.request("put", params, {}, `${this.baseApi}/read-all`);
  };
  batchRead = (data?: object) => {
    return this.request("put", {}, data, `${this.baseApi}/read`);
  };
}

export const userNoticeReadApi = new UserNoticeReadApi(
  "/api/system/user/notice"
);
