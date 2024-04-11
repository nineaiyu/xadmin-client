import { BaseApi } from "@/api/base";

class SystemConfigApi extends BaseApi {
  invalid = (pk: number | string) => {
    return this.request("post", {}, {}, `${this.baseApi}/${pk}/invalid`);
  };
}

export const systemConfigApi = new SystemConfigApi("/api/system/config/system");
