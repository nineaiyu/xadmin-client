import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class UserConfigApi extends BaseApi {
  invalid = (pk: number | string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/invalid`
    );
  };
}

export const userConfigApi = new UserConfigApi("/api/system/config/user");
