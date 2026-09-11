import { http } from "@/utils/http";
import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 导入记录（下载中心「导入记录」页签） */
class ImportRecordApi extends BaseApi {
  /** 下载失败行错误报告（走鉴权，非 /media/ 直出） */
  download = (pk: string | number) => {
    return http.autoDownload(`${this.baseApi}/${pk}/download`);
  };
  /** 近 N 天统计（总数 / 进行中 / 失败 / 最近一次），服务端 10s 短缓存 */
  stats = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/stats`);
  };
}

export const importRecordApi = new ImportRecordApi("/api/system/imports");
