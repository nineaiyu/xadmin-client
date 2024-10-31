import { http } from "@/utils/http";
import type { PureHttpRequestConfig, RequestMethods } from "@/utils/http/types";
import type {
  BaseResult,
  ChoicesResult,
  DetailResult,
  ListResult,
  SearchColumnsResult,
  SearchFieldsResult
} from "@/api/types";
import { buildUUID, downloadByData } from "@pureadmin/utils";

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

  /*
   *判断是否有文件类型数据，如果 有的话，使用form-data 上传
   */
  private hasFileObject = (data?: object) => {
    for (const item of Object.values(data ?? {})) {
      if (File.prototype.isPrototypeOf(item)) return true;
      if (item instanceof Array) {
        for (const i of item) {
          if (File.prototype.isPrototypeOf(i)) return true;
        }
      }
    }
    return false;
  };

  request<T>(
    method: RequestMethods,
    params?: object,
    data?: object,
    url: string = null,
    axiosConfig: PureHttpRequestConfig = {}
  ) {
    if (this.hasFileObject(data)) {
      axiosConfig = {
        ...axiosConfig,
        ...{
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      };
    }
    return http.request<T>(
      method,
      url ?? this.baseApi,
      {
        params: this.formatParams(params),
        data: data
      },
      axiosConfig
    );
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
  fields = (params?: object) => {
    return this.request<SearchFieldsResult>(
      "get",
      params,
      {},
      `${this.baseApi}/search-fields`
    );
  };
  columns = (params?: object) => {
    return this.request<SearchColumnsResult>(
      "get",
      params,
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
  retrieve = (pk: number | string, params?: object) => {
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
  partialUpdate = (pk: number | string, data?: object) => {
    return this.request<DetailResult>(
      "patch",
      {},
      data,
      `${this.baseApi}/${pk}`
    );
  };
  destroy = (pk: number | string, params?: object) => {
    return this.request<BaseResult>(
      "delete",
      params,
      {},
      `${this.baseApi}/${pk}`
    );
  };
  batchDestroy = (pks: Array<number | string>) => {
    return this.request<BaseResult>(
      "post",
      {},
      { pks },
      `${this.baseApi}/batch-destroy`
    );
  };
  upload = (pk: number | string, data?: object, action?: string) => {
    return http.upload<BaseResult, any>(
      `${this.baseApi}/${pk}/${action ?? "upload"}`,
      {},
      data
    );
  };
  exportData = async (params: object) => {
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
        downloadByData(
          data,
          decodeURI(
            matches ? matches[1] : `${buildUUID()}.${(params as any)?.type}`
          )
        );
      });
  };

  importData = (params: object, data: File) => {
    return http.upload<DetailResult, any>(
      `${this.baseApi}/import-data`,
      params,
      data as any,
      {
        headers: {
          "Content-Type": data.type === "text/csv" ? "text/csv" : "text/xlsx"
        }
      }
    );
  };
}

export class ViewBaseApi extends BaseRequest {
  columns = (params?: object) => {
    return this.request<SearchColumnsResult>(
      "get",
      params,
      {},
      `${this.baseApi}/search-columns`
    );
  };
  create = (params?: object, data?: object) => {
    return this.request<DetailResult>("post", params, data);
  };
  retrieve = (params?: object) => {
    return this.request<DetailResult>("get", params, {}, `${this.baseApi}`);
  };
  update = (params?: object, data?: object) => {
    return this.request<DetailResult>("put", params, data, `${this.baseApi}`);
  };
  partialUpdate = (params?: object, data?: object) => {
    return this.request<DetailResult>("patch", params, data, `${this.baseApi}`);
  };
}
