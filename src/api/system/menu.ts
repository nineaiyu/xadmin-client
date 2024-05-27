import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult, ListResult } from "@/api/types";

class MenuApi extends BaseApi {
  permissions = (params?: object) => {
    return this.request<ListResult>(
      "get",
      params,
      {},
      `${this.baseApi}/permissions`
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
