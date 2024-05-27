import { http } from "@/utils/http";
import type { RequestMethods } from "@/utils/http/types";
import type {
  BaseResult,
  ChoicesResult,
  DetailResult,
  ListResult,
  SearchFieldsResult
} from "@/api/types";

export class BaseRequest {
  baseApi = "";

  constructor(baseApi: string) {
    this.baseApi = baseApi;
  }

  request<T>(
    method: RequestMethods,
    params?: object,
    data?: object,
    url: string = null
  ) {
    const notNullParams = {};
    Object.keys(params ?? {}).forEach(item => {
      if (params[item] !== "") {
        notNullParams[item] = params[item];
      }
    });
    return http.request<T>(method, url ?? this.baseApi, {
      params: notNullParams,
      data: data
    });
  }
}

export class BaseApi extends BaseRequest {
  choices = () => {
    return this.request<ChoicesResult>(
      "get",
      {},
      {},
      `${this.baseApi}/choices`
    );
  };
  fields = () => {
    return this.request<SearchFieldsResult>(
      "get",
      {},
      {},
      `${this.baseApi}/search-fields`
    );
  };
  list = (params?: object) => {
    return this.request<ListResult>("get", params, {});
  };
  create = (data?: object) => {
    return this.request<DetailResult>("post", {}, data);
  };
  detail = (pk: number | string, params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/${pk}`
    );
  };
  update = (pk: number | string, data?: object) => {
    return this.request<DetailResult>("put", {}, data, `${this.baseApi}/${pk}`);
  };
  patch = (pk: number | string, data?: object) => {
    return this.request<DetailResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/${pk}`
    );
  };
  delete = (pk: number | string, params?: object) => {
    return this.request<BaseResult>(
      "delete",
      params,
      {},
      `${this.baseApi}/${pk}`
    );
  };
  batchDelete = (pks: Array<Number | String>) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks },
      `${this.baseApi}/batch-delete`
    );
  };
  upload = (pk: number | string, data?: object) => {
    return http.upload<BaseResult, any>(
      `${this.baseApi}/${pk}/upload`,
      {},
      data
    );
  };
}
