import { http } from "@/utils/http";
import type { RequestMethods } from "@/utils/http/types";
import type {
  BaseResult,
  ChoicesResult,
  DetailResult,
  ListResult,
  SearchColumnsResult,
  SearchFieldsResult
} from "@/api/types";
import { downloadByData } from "@pureadmin/utils";

export class BaseRequest {
  baseApi = "";

  constructor(baseApi: string) {
    this.baseApi = baseApi;
  }

  formatParams = (params?: object) => {
    const notNullParams = {};
    Object.keys(params ?? {}).forEach(item => {
      if (params[item] !== "") {
        notNullParams[item] = params[item];
      }
    });
    return notNullParams;
  };

  request<T>(
    method: RequestMethods,
    params?: object,
    data?: object,
    url: string = null
  ) {
    return http.request<T>(method, url ?? this.baseApi, {
      params: this.formatParams(params),
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
  columns = () => {
    return this.request<SearchColumnsResult>(
      "get",
      {},
      {},
      `${this.baseApi}/search-columns`
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
  upload = (pk: number | string, data?: object, action?: string) => {
    return http.upload<BaseResult, any>(
      `${this.baseApi}/${pk}/${action ?? "upload"}`,
      {},
      data
    );
  };
  export = async (params: object) => {
    return http
      .request(
        "get",
        `${this.baseApi}/export-data`,
        { params: this.formatParams(params) },
        {
          responseType: "blob"
        }
      )
      .then(({ data, headers }: any) => {
        const filenameRegex = /filename[^;=\n]*="((['"]).*?\2|[^;\n]*)"/;
        const matches = filenameRegex.exec(headers.get("content-disposition"));
        downloadByData(data, decodeURI(matches[1]));
      });
  };

  import = (action: string, data: object) => {
    return http.upload<BaseResult, {}>(
      `${this.baseApi}/import-data?action=${action}`,
      {},
      data,
      {
        headers: {
          "Content-Type": "text/xlsx"
        }
      }
    );
  };
}
