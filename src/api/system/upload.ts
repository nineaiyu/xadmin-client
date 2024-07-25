import { http } from "@/utils/http";
import type { PureHttpRequestConfig } from "@/utils/http/types";
import type { DetailResult } from "@/api/types";

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

class UploadFileApi {
  baseApi = "";

  constructor(baseApi: string) {
    this.baseApi = baseApi;
  }
  upload = (params?: object, data?: object, config?: PureHttpRequestConfig) => {
    return http.upload<UploadFileResult, any>(
      this.baseApi,
      params,
      data,
      config
    );
  };
  config = (params?: object, config?: PureHttpRequestConfig) => {
    return http.get<DetailResult, {}>(this.baseApi, params, config);
  };
}

export const uploadFileApi = new UploadFileApi("/api/system/upload");
