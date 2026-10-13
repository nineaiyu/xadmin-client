import { storageLocal } from "@pureadmin/utils";
import { getConfig, responsiveStorageNameSpace } from "@/config";

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

/**
 * 站点标题（侧栏 / 顶栏品牌区与动态标签页共用）：偏好优先——设置面板「站点标题」
 * 或站点配置（后端）同步下发，回落 `platform-config.json` 的 `Title`。
 *
 * 非响应式读取（路由守卫 / 首屏装配用）；组件内请用 `useNav().title`（响应式）。
 */
export function resolveSiteTitle(): string {
  return readConfigurePreferences().title || getConfig().Title || "";
}
