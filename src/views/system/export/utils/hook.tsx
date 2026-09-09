import { exportRecordApi } from "@/api/system/export";
import { useRecordCenter } from "./recordCenter";

/**
 * 导出记录页签：权限码挂页面组件名 SystemExportRecord（页签化后组件为
 * ExportRecordPanel），列表装配与导入记录共用 useRecordCenter。
 */
export function useExportRecord() {
  return useRecordCenter({
    localePrefix: "systemExportRecord",
    componentName: "SystemExportRecord",
    api: exportRecordApi,
    sizeKey: "filesize"
  });
}
