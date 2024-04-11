import { BaseApi } from "@/api/base";

class ModelLabelFieldApi extends BaseApi {
  lookups = (params?: object) => {
    return this.request("get", params, {}, `${this.baseApi}/lookups`);
  };

  sync = (params?: object) => {
    return this.request("get", params, {}, `${this.baseApi}/sync`);
  };
}

export const modelLabelFieldApi = new ModelLabelFieldApi("/api/system/field");
