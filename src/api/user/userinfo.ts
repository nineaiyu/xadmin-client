import type { UserInfoResult } from "@/api/auth";

import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class UserInfoApi extends BaseApi {
  reset = (data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/reset-password`
    );
  };

  self = (pk: string = "self") => {
    return this.request<UserInfoResult>("get", {}, {}, `${this.baseApi}/${pk}`);
  };
}

export const userInfoApi = new UserInfoApi("/api/system/userinfo");
