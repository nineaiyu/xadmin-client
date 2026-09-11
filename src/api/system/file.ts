import type { AxiosResponse } from "axios";
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
  /**
   * 在线预览（走鉴权，不暴露 /media/ 直链）：
   * 图片/PDF 返回二进制，文本返回 `text/plain`（由调用方按 `preview_kind` 分流）。
   */
  preview = (pk: string | number, params?: object) => {
    return http.download<AxiosResponse<Blob>>(
      `${this.baseApi}/${pk}/preview`,
      params
    );
  };
}

export const systemUploadFileApi = new SystemUploadFileApi("/api/system/file");
