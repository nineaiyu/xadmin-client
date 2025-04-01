import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";
import type { PureHttpRequestConfig } from "@/utils/http/types";
import { http } from "@/utils/http";

class UserApi extends BaseApi {
  upload = (
    pk?: number | string,
    data?: object,
    action?: string,
    config?: PureHttpRequestConfig
  ) => {
    return http.upload<BaseResult | any, any>(
      `${this.baseApi}/${pk}/${action ?? "upload"}`,
      {},
      data,
      config
    );
  };
  resetPassword = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/reset-password`
    );
  };

  empower = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/empower`
    );
  };
  unblock = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/unblock`
    );
  };
  logout = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/logout`
    );
  };
}

export const userApi = new UserApi("/api/system/user");
