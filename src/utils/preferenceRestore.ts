import { cloneDeep } from "@pureadmin/utils";
import type { PreferenceBaseline } from "@/utils/preferenceDiff";

/** 「撤销本次调整」回填的三命名空间值 */
export interface PreferenceRestorePayload {
  locale: ResponsiveStorage["locale"];
  layout: ResponsiveStorage["layout"];
  configure: ResponsiveStorage["configure"];
}

/**
 * 构建「撤销本次调整」的回填值：把三命名空间恢复到打开面板时的同步基线。
 *
 * - 深拷贝：回填后的对象会被面板按字段就地改写（`$storage.configure = obj` 语义），
 *   直接共享基线引用会被改坏，脏标记随即失去比对基准；
 * - `sidebarStatus`（侧栏折叠态）由布局交互直接驱动、不计入偏好差异，
 *   回填时保留当前值，避免「撤销顺带把侧栏折叠态也翻回基线」；
 * - 基线缺失（站点配置尚未同步且未兜底捕获）时返回 `null`，调用方直接跳过。
 */
export function buildRestorePayload(
  baseline: PreferenceBaseline | null | undefined,
  currentLayout: ResponsiveStorage["layout"] | undefined
): PreferenceRestorePayload | null {
  if (!baseline) return null;
  const layout = cloneDeep(
    baseline.layout ?? {}
  ) as ResponsiveStorage["layout"];
  layout.sidebarStatus = currentLayout?.sidebarStatus;
  return {
    locale: cloneDeep(baseline.locale ?? {}) as ResponsiveStorage["locale"],
    layout,
    configure: cloneDeep(
      baseline.configure ?? {}
    ) as ResponsiveStorage["configure"]
  };
}
