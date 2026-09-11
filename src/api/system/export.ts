import { http } from "@/utils/http";
import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 导出下载中心 */
class ExportRecordApi extends BaseApi {
  /** 下载导出文件（走鉴权，非 /media/ 直出） */
  download = (pk: string | number) => {
    return http.autoDownload(`${this.baseApi}/${pk}/download`);
  };
  /** 近 N 天统计（总数 / 进行中 / 失败 / 最近一次），服务端 10s 短缓存 */
  stats = () => {
    return this.request<DetailResult>("get", {}, {}, `${this.baseApi}/stats`);
  };
}

export const exportRecordApi = new ExportRecordApi("/api/system/exports");
