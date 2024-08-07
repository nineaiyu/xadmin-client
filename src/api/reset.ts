import type { DetailResult } from "@/api/types";
import { BaseRequest } from "@/api/base";

export type ResetInfoResult = {
  code: number;
  detail: string;
  data: {
    access: boolean;
    captcha: boolean;
    token: boolean;
    encrypted: boolean;
    email: boolean;
    sms: boolean;
    rate: number;
    password?: Array<any>;
  };
};

export type SendResult = {
  code: number;
  detail: string;
  data: {
    reset_passwd_token: string;
  };
};

class ResetPassword extends BaseRequest {
  detail = (params?: object) => {
    return this.request<ResetInfoResult>("get", params, {}, `${this.baseApi}`);
  };
  reset = (data?: object) => {
    return this.request<DetailResult>(
      "post",
      {},
      data,
      `${this.baseApi}/reset`
    );
  };
  send = (data?: object) => {
    return this.request<SendResult>("post", {}, data, `${this.baseApi}/send`);
  };
}

export const resetPasswordApi = new ResetPassword("/api/system/password");
