import { storageLocal } from "@pureadmin/utils";

import { responsiveStorageNameSpace } from "@/config";

/**
 * 自动检查更新（本地偏好）：是否允许后台轮询部署端的 version.json。
 *
 * 已部署实例发布新版本后的「发现新版本」提示依赖该轮询；关闭后不再发起
 * 轮询（设置面板「关于」页签仍可手动检查一次）。开关存 localStorage
 * （带项目命名空间），默认开启——与历史行为一致。
 */

const STORAGE_KEY = "check-updates-enabled";

export function checkUpdatesEnabled(): boolean {
  return (
    storageLocal().getItem<boolean>(
      `${responsiveStorageNameSpace()}${STORAGE_KEY}`
    ) !== false
  );
}

export function setCheckUpdatesEnabled(enabled: boolean): void {
  storageLocal().setItem(
    `${responsiveStorageNameSpace()}${STORAGE_KEY}`,
    enabled
  );
}
