import { BaseApi } from "@/api/base";
import type { BaseResult } from "@/api/types";

class SystemConfigApi extends BaseApi {
  invalid = (pk: number | string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/invalid`
    );
  };
}

export const systemConfigApi = new SystemConfigApi("/api/system/config/system");
