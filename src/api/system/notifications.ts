import type { DetailResult } from "@/api/types";
import { BaseRequest } from "@/api/base";
import type { DataListResult } from "@/api/types";

/** 接收渠道（backends 接口返回） */
export type MsgBackendItem = {
  value: string;
  label: string;
};

/** 系统消息订阅行（分类的子级） */
export type MsgSubscriptionItem = {
  message_type: string;
  message_type_label: string;
  receive_backends: string[];
  receivers: { pk: number | string; label: string }[];
};

/** 系统消息订阅分类（list 接口返回） */
export type MsgSubscriptionCategory = {
  category: string;
  category_label: string;
  children: MsgSubscriptionItem[];
};

export class SystemMsgSubscriptionApi extends BaseRequest {
  backends = () => {
    return this.request<DataListResult<MsgBackendItem>>(
      "get",
      {},
      {},
      `${this.baseApi}/backends`
    );
  };

  list = (params?: object) => {
    return this.request<DetailResult<MsgSubscriptionCategory[]>>(
      "get",
      params,
      {}
    );
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
