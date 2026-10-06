import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult } from "@/api/types";

class ModelLabelFieldApi extends BaseApi {
  lookups = (params?: object) => {
    return this.request<DataListResult>(
      "get",
      params,
      {},
      `${this.baseApi}/lookups`
    );
  };

  // 全量字段同步有写副作用，必须用 POST：GET 可被浏览器预取/代理重放误触发
  sync = (params?: object) => {
    return this.request<BaseResult>("post", params, {}, `${this.baseApi}/sync`);
  };
}

export const modelLabelFieldApi = new ModelLabelFieldApi("/api/system/field");
