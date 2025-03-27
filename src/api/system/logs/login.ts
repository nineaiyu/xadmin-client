import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class LoginLogApi extends BaseApi {
  logout = (pk: number | string, data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/logout`
    );
  };
}
export const loginLogApi = new LoginLogApi("/api/system/logs/login");
