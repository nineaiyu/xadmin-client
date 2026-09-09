import { http } from "@/utils/http";
import { BaseApi } from "@/api/base";

/** 导出下载中心 */
class ExportRecordApi extends BaseApi {
  /** 下载导出文件（走鉴权，非 /media/ 直出） */
  download = (pk: string | number) => {
    return http.autoDownload(`${this.baseApi}/${pk}/download`);
  };
}

export const exportRecordApi = new ExportRecordApi("/api/system/exports");
