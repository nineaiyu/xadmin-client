import { importRecordApi } from "@/api/system/import";
import { useRecordCenter } from "./recordCenter";

/**
 * 导入记录页签：页签无独立菜单，权限码以组件名 SystemImportRecord 显式判权
 * （download 权限码挂在下载中心菜单下）；列表装配与导出记录共用 useRecordCenter。
 */
export function useImportRecord() {
  return useRecordCenter({
    localePrefix: "systemImportRecord",
    componentName: "SystemImportRecord",
    api: importRecordApi,
    sizeKey: "report_filesize"
  });
}
