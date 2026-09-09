import { http } from "@/utils/http";
import { BaseApi } from "@/api/base";

/** 导入记录（下载中心「导入记录」页签） */
class ImportRecordApi extends BaseApi {
  /** 下载失败行错误报告（走鉴权，非 /media/ 直出） */
  download = (pk: string | number) => {
    return http.autoDownload(`${this.baseApi}/${pk}/download`);
  };
}

export const importRecordApi = new ImportRecordApi("/api/system/imports");
