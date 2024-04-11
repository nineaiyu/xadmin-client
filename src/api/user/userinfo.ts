import { http } from "@/utils/http";
import type { UserInfoResult } from "@/api/auth";

import { BaseApi } from "@/api/base";

class UserInfoApi extends BaseApi {
  reset = (data?: object) => {
    return this.request("post", {}, data, `${this.baseApi}/reset-password`);
  };

  self = (pk: string = "self") => {
    return http.request<UserInfoResult>("get", `${this.baseApi}/${pk}`);
  };
}

export const userInfoApi = new UserInfoApi("/api/system/userinfo");
