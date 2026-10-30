import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

/** 公告正文格式（创建时确定，编辑期不可切换） */
export type MessageFormat = "html" | "markdown";

class NoticeApi extends BaseApi {
  announcement = (data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/announcement`
    );
  };
  publish = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/${pk}/publish`
    );
  };
}

export const noticeApi = new NoticeApi("/api/notifications/notice-messages");

// 用户已读公告查询
class NoticeReadApi extends BaseApi {
  state = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/${pk}/state`
    );
  };
  /** 当前筛选结果内私信全部已读（公告族不参与） */
  allRead = () => {
    return this.request<BaseResult>(
      "patch",
      {},
      {},
      `${this.baseApi}/all-read`
    );
  };
}

export const noticeReadApi = new NoticeReadApi(
  "/api/notifications/user-read-messages"
);
