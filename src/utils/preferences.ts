import { cloneDeep, storageLocal } from "@pureadmin/utils";
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

/**
 * 实际生效的初始语言：本地存储优先，回落 platform-config 的 `Locale`，最后回落 `zh`。
 *
 * 与 `useLayout.initStorage`（登录页）的写入优先级同源——存储为空时才采用
 * `$config.Locale`。首屏预加载语料必须与「组件真正会应用的语言」一致，否则会
 * 先按 en 渲染再补语料（vue-i18n 报 key not found 并回退中文）。
 */
export function resolveBootLocale(
  storedLocale?: string,
  platformLocale?: string
): string {
  return storedLocale || platformLocale || "zh";
}

/**
 * 平台**出厂**默认值快照（装配期捕获一次，供「恢复站点默认」取值）。
 *
 * `getSiteConfig` 成功后会把服务端站点配置合并进全局配置（`setConfig`），此后
 * `getConfig()` 已不再等于 `public/platform-config.json` 的出厂值——因此必须在站点
 * 配置同步**之前**冻结一份。部署方替换 dist 下的 `platform-config.json` 即改默认值，
 * 前端不二次硬编码。
 */
let platformDefaults: PlatformConfigs = {};

/** 捕获平台默认值（`main.ts` 装配期调用一次，须早于站点配置同步） */
export function capturePlatformDefaults(): void {
  platformDefaults = cloneDeep(getConfig());
}

/**
 * 读取平台默认值。平台配置缺该键时返回 `undefined`，
 * 调用方按「无默认值」跳过（不把 `undefined` 写进存储）。
 */
export function getPlatformDefault<K extends keyof PlatformConfigs>(
  key: K
): PlatformConfigs[K] {
  return platformDefaults[key];
}
