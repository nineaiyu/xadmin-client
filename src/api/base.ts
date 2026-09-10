import { http } from "@/utils/http";
import { dataToFormData } from "@/utils/form";
import type { PureHttpRequestConfig, RequestMethods } from "@/utils/http/types";
import type {
  BaseResult,
  ChoicesResult,
  DetailResult,
  ListResult,
  SearchColumnsResult,
  SearchFieldsResult
} from "@/api/types";

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
      // 含文件表单显式按 FormData 协议 v1（component utils/form.ts）展开，
      // 不再依赖 axios formSerializer 隐式序列化；content-type 交由 axios
      // 对 FormData 自动设置（含 multipart boundary）
      return http.request<T>(
        method,
        url ?? this.baseApi,
        {
          params: this.formatParams(params),
          data: dataToFormData(data)
        },
        axiosConfig
      );
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
  /**
   * 按主键取详情：与 retrieve 同协议，作为「编辑态取原文」的能力入口。
   *
   * RePlusPage 据此判断页面是否支持详情拉取（ViewBaseApi 的单对象接口无此方法，
   * 不会触发多余的详情请求）。
   */
  detail = (pk: number | string, params?: object) => {
    return this.retrieve(pk, params);
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
      [...pks],
      `${this.baseApi}/batch-destroy`
    );
  };

  /** 回收站列表（软删除数据，仅混入 RecycleBinAction 的视图集可用） */
  recycleList = (params?: object) => {
    return this.request<ListResult>(
      "get",
      params,
      {},
      `${this.baseApi}/recycle`
    );
  };
  /** 从回收站恢复数据 */
  recycleRestore = (pks: Array<string | number>) => {
    return this.request<BaseResult>(
      "patch",
      {},
      { pks },
      `${this.baseApi}/recycle/restore`
    );
  };
  /** 物理清除回收站数据（不传 pks 时清除全部超过保留期的数据） */
  recyclePurge = (pks?: Array<string | number>) => {
    return this.request<BaseResult>(
      "delete",
      {},
      pks?.length ? { pks } : {},
      `${this.baseApi}/recycle/purge`
    );
  };
  exportData = (params: object) => {
    return http.autoDownload(
      `${this.baseApi}/export-data`,
      null,
      this.formatParams(params)
    );
  };

  /** 异步导出（大数据量）：提交后台任务，产物在「下载中心」获取 */
  exportAsync = (data?: object) => {
    return this.request<BaseResult>(
      "post",
      {},
      data ?? {},
      `${this.baseApi}/export-async`
    );
  };

  importData = (params: object, data: File) => {
    return http.upload<DetailResult, File>(
      `${this.baseApi}/import-data`,
      params,
      data,
      {
        headers: {
          "Content-Type": data.type === "text/csv" ? "text/csv" : "text/xlsx"
        }
      }
    );
  };

  /** 导入前校验（逐行校验不落库，返回错误行定位）：协议与 import-data 同源（原始文件 body） */
  importValidate = (params: object, data: File) => {
    return http.upload<DetailResult, File>(
      `${this.baseApi}/import-validate`,
      params,
      data,
      {
        headers: {
          "Content-Type": data.type === "text/csv" ? "text/csv" : "text/xlsx"
        }
      }
    );
  };

  /** 异步导入（大数据量）：提交后台任务，进度与错误报告在「下载中心」获取 */
  importAsync = (params: object, data: File) => {
    return http.upload<DetailResult, File>(
      `${this.baseApi}/import-async`,
      params,
      data,
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
