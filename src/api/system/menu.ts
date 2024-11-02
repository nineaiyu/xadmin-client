import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult } from "@/api/types";

class MenuApi extends BaseApi {
  permissions = (pk: string, data: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data,
      `${this.baseApi}/${pk}/permissions`
    );
  };
  rank = (data?: object) => {
    return this.request<BaseResult>("post", {}, data, `${this.baseApi}/rank`);
  };
  apiUrl = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `${this.baseApi}/api-url`
    );
  };
}

export const menuApi = new MenuApi("/api/system/menu");
