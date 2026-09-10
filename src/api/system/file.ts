import { BaseApi } from "@/api/base";
import { http } from "@/utils/http";
import type { DetailResult } from "@/api/types";
import type { PureHttpRequestConfig } from "@/utils/http/types";

type UploadFileResult = {
  code: number;
  data?: Array<{
    pk: number | string;
    filename: string;
    access_url: string;
    filesize: number;
  }>;
  detail?: string;
};

class SystemUploadFileApi extends BaseApi {
  upload = (data?: object, config?: PureHttpRequestConfig) => {
    return http.upload<UploadFileResult, object>(
      `${this.baseApi}/upload`,
      {},
      data,
      config
    );
  };
  config = (params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/config`
    );
  };
  /** 个人文件统计（数量/总大小/配额使用率）；服务端 10s 短缓存 */
  stats = (params?: object) => {
    return this.request<DetailResult>(
      "get",
      params,
      {},
      `${this.baseApi}/stats`
    );
  };
}

export const systemUploadFileApi = new SystemUploadFileApi("/api/system/file");
