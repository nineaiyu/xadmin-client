import { storageLocal } from "@pureadmin/utils";
import { responsiveStorageNameSpace } from "@/config";

/**
 * 界面偏好快照（设置面板 →「复制偏好」）。
 *
 * 复制**当前完整偏好**（locale / layout / configure 三个命名空间的全量值），
 * 而非「与平台默认值的差异项」——只改少量偏好时差异输出会缺项，
 * 反馈问题时无法据此还原完整界面状态。全量镜像天然覆盖新增偏好，
 * 新增字段无需在此登记（改动命名空间时同步 SNAPSHOT_NAMESPACES 与守护测试）。
 */

/** 快照覆盖的存储命名空间（与 ResponsiveStorage 的键一一对应） */
export const SNAPSHOT_NAMESPACES = ["locale", "layout", "configure"] as const;

export type PreferenceSnapshot = {
  /** 界面语言 */
  locale: string;
  /** 布局 / 主题 / 侧栏等导航级偏好 */
  layout: Record<string, unknown>;
  /** 界面显示与交互偏好 */
  configure: Record<string, unknown>;
};

/** 构建当前界面偏好快照（存储尚未初始化时给空对象，不抛错） */
export function buildPreferenceSnapshot(): PreferenceSnapshot {
  const nameSpace = responsiveStorageNameSpace();
  const store = storageLocal();
  const locale = store.getItem<{ locale?: string }>(`${nameSpace}locale`);
  const layout = store.getItem<Record<string, unknown>>(`${nameSpace}layout`);
  const configure = store.getItem<Record<string, unknown>>(
    `${nameSpace}configure`
  );

  return {
    locale: locale?.locale ?? "zh",
    layout: layout ?? {},
    configure: configure ?? {}
  };
}
