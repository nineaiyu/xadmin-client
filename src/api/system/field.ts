import { BaseApi } from "@/api/base";
import type { BaseResult, ChoicesResult, DataListResult } from "@/api/types";

class ModelLabelFieldApi extends BaseApi {
  /** 枚举选项元数据：显式声明（与 BaseApi 同名方法同实现），保证契约面可读、改动就地下沉 */
  choices = () => {
    return this.request<ChoicesResult>(
      "get",
      {},
      {},
      `${this.baseApi}/choices`
    );
  };

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
