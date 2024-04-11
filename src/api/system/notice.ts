import { BaseApi } from "@/api/base";

class NoticeApi extends BaseApi {
  announcement = (data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/announcement`);
  };
  publish = (pk: number | string, data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/${pk}/publish`);
  };
}

export const noticeApi = new NoticeApi("/api/system/message/notice");

// 用户已读公告查询
class NoticeReadApi extends BaseApi {
  state = (pk: number | string, data?: object) => {
    return this.request("put", {}, data, `${this.baseApi}/${pk}/state`);
  };
}

export const noticeReadApi = new NoticeReadApi("/api/system/message/read");
