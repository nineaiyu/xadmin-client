import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class UserApi extends BaseApi {
  reset = (pk: number | string, data?: object) => {
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
}

export const userApi = new UserApi("/api/system/user");
