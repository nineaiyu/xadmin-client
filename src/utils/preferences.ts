import { storageLocal } from "@pureadmin/utils";
import { responsiveStorageNameSpace } from "@/config";

/**
 * 界面偏好快照（非 setup 上下文用：路由守卫、导航动作等一次性读取场景）。
 *
 * 与组件内的响应式 `$storage.configure` 同源——响应式存储每次写入都会同步落
 * localStorage，因此这里读到的是最新值（设置面板改动即时生效，无需等站点配置往返）。
 */
export function readConfigurePreferences(): ResponsiveStorage["configure"] {
  return (
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}configure`
    ) ?? {}
  );
}
