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

  sync = (params?: object) => {
    return this.request<BaseResult>("get", params, {}, `${this.baseApi}/sync`);
  };
}

export const modelLabelFieldApi = new ModelLabelFieldApi("/api/system/field");
