import { ViewBaseApi } from "@/api/base";
import type { BaseResult, ChoicesResult } from "@/api/types";
import { http } from "@/utils/http";
import type { UserInfoResult } from "@/api/auth";

class UserInfoApi extends ViewBaseApi {
  upload = (data?: object) => {
    return http.upload<BaseResult, any>(`${this.baseApi}/upload`, {}, data);
  };
  choices = () => {
    return this.request<ChoicesResult>(
      "get",
      {},
      {},
      `${this.baseApi}/choices`
    );
  };
  resetPassword = (data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/reset-password`
    );
  };

  bind = (data?: object) => {
    return this.request<BaseResult>("post", {}, data, `${this.baseApi}/bind`);
  };

  retrieve = (params?: object) => {
    return this.request<UserInfoResult>("get", params, {}, `${this.baseApi}`);
  };
}

export const userInfoApi = new UserInfoApi("/api/system/userinfo");
