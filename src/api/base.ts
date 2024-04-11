import { http } from "@/utils/http";
import type { Result } from "@/api/types";
import type { RequestMethods } from "@/utils/http/types";

export class BaseRequest {
  baseApi = "";

  constructor(baseApi: string) {
    this.baseApi = baseApi;
  }

  request = (
    method: RequestMethods,
    params?: object,
    data?: object,
    url: string = null
  ) => {
    const notNullParams = {};
    Object.keys(params ?? {}).forEach(item => {
      if (params[item] !== "") {
        notNullParams[item] = params[item];
      }
    });
    return http.request<Result>(method, url ?? this.baseApi, {
      params: notNullParams,
      data: data
    });
  };
}

export class BaseApi extends BaseRequest {
  choices = () => {
    return this.request("get", {}, {}, `${this.baseApi}/choices`);
  };
  fields = () => {
    return this.request("get", {}, {}, `${this.baseApi}/search-fields`);
  };
  list = (params?: object) => {
    return this.request("get", params, {});
  };
  create = (data?: object) => {
    return this.request("post", {}, data);
  };
  detail = (pk: number | string, params?: object) => {
    return this.request("get", params, {}, `${this.baseApi}/${pk}`);
  };
  update = (pk: number | string, data?: object) => {
    return this.request("put", {}, data, `${this.baseApi}/${pk}`);
  };
  patch = (pk: number | string, data?: object) => {
    return this.request("patch", {}, data, `${this.baseApi}/${pk}`);
  };
  delete = (pk: number | string, params?: object) => {
    return this.request("delete", params, {}, `${this.baseApi}/${pk}`);
  };
  batchDelete = (pks: Array<Number | String>) => {
    return this.request("post", {}, { pks }, `${this.baseApi}/batch-delete`);
  };
  upload = (pk: number | string, data?: object) => {
    return http.upload<Result>(`${this.baseApi}/${pk}/upload`, {}, data);
  };
}
