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
    return http.upload<UploadFileResult, any>(
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
}

export const systemUploadFileApi = new SystemUploadFileApi("/api/system/file");
