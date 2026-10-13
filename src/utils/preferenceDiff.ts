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

export type PreferenceNamespace = (typeof SNAPSHOT_NAMESPACES)[number];

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

/* ------------------------------------------------------------------ */
/* 偏好差异（设置面板「重置配置」脏标记）                                 */
/* ------------------------------------------------------------------ */

/**
 * 差异比对的三命名空间形态（与 `ResponsiveStorage` 的 locale / layout / configure 对应）。
 * - 基线：站点配置同步完成（或首次打开设置面板）时对三命名空间的快照；
 * - 刻意不采用「与平台发布默认比对」：历史库的系统默认可能不同于前端发布默认，
 *   用户未做任何改动时会出现误报；同步基线与「重置配置 → 重载 → 重新同步」
 *   链路自洽（重载后基线重新捕获，标记自动熄灭）。
 */
export interface PreferenceDiffInput {
  locale?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  configure?: Record<string, unknown>;
}

export interface PreferenceDiff {
  locale: Record<string, unknown>;
  layout: Record<string, unknown>;
  configure: Record<string, unknown>;
}

/** 偏好比对基线（站点配置同步完成时的三命名空间快照，siteConfig store 持有） */
export type PreferenceBaseline = PreferenceDiffInput;

/**
 * 差异比对排除的键：由布局交互直接驱动、面板无配置入口的纯状态位。
 * - `sidebarStatus`：侧栏折叠态（Alt+S / 折叠按钮 / 悬停展开直接改写），
 *   不属于「面板偏好」，若计入会让折叠侧栏后脏标记常亮。
 */
const DIFF_EXCLUDED_KEYS: Record<PreferenceNamespace, readonly string[]> = {
  locale: [],
  layout: ["sidebarStatus"],
  configure: []
};

/** 值等价判定：原始值身份比较 + 结构序列化比较（数组顺序敏感，对齐 diffStrict 口径） */
function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** 单命名空间差异：以基线键为基准遍历，当前值缺失或变更即计入（仅存在于当前值的键不算差异） */
export function diffNamespace(
  current: Record<string, unknown> | undefined,
  baseline: Record<string, unknown> | undefined,
  excluded: readonly string[] = []
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, baseValue] of Object.entries(baseline ?? {})) {
    if (excluded.includes(key)) continue;
    const currentValue = current?.[key];
    if (!isSameValue(currentValue, baseValue)) {
      result[key] = currentValue;
    }
  }
  return result;
}

/**
 * 构建偏好差异（当前值 vs 基线）。基线缺失（尚未捕获）时返回空差异——
 * 面板打开路径会先经 `ensurePreferenceBaseline` 兜底捕获，不会长期为空。
 */
export function buildPreferenceDiff(
  current: PreferenceDiffInput,
  baseline: PreferenceDiffInput | null | undefined
): PreferenceDiff {
  if (!baseline) {
    return { locale: {}, layout: {}, configure: {} };
  }
  return {
    locale: diffNamespace(
      current.locale,
      baseline.locale,
      DIFF_EXCLUDED_KEYS.locale
    ),
    layout: diffNamespace(
      current.layout,
      baseline.layout,
      DIFF_EXCLUDED_KEYS.layout
    ),
    configure: diffNamespace(
      current.configure,
      baseline.configure,
      DIFF_EXCLUDED_KEYS.configure
    )
  };
}

/** 差异是否非空（任一命名空间存在差异项） */
export function hasPreferenceDiff(diff: PreferenceDiff): boolean {
  return (
    Object.keys(diff.locale).length > 0 ||
    Object.keys(diff.layout).length > 0 ||
    Object.keys(diff.configure).length > 0
  );
}
