import type { RecordType } from "plus-pro-components";
import type { StatsChip } from "./stats";

/**
 * 账号安全风险清单的展示常量与纯函数（自 hook 拆出，行为不变）：
 * 标签映射 / i18n 键表 / 明细指标结构化处理，供 hook、列渲染与抽屉共用。
 */

export type TagType = "primary" | "success" | "warning" | "info" | "danger";

/** 风险等级 / 状态 → ElTag type 映射（与后端 RISK_LEVEL_COLORS 同语义） */
export const LEVEL_TAG: Record<string, TagType> = {
  high: "danger",
  medium: "warning",
  low: "info"
};
export const STATUS_TAG: Record<string, TagType> = {
  pending: "warning",
  resolved: "success",
  ignored: "info"
};

/** 风险类型 → i18n label（后端 choices 的英文 label 仅兜底） */
export const RISK_TYPE_KEYS: Record<string, string> = {
  password_expired: "accountRisk.typePasswordExpired",
  password_stale: "accountRisk.typePasswordStale",
  login_stale: "accountRisk.typeLoginStale",
  never_logged_in: "accountRisk.typeNeverLoggedIn",
  superuser_no_mfa: "accountRisk.typeSuperuserNoMfa",
  superuser_count: "accountRisk.typeSuperuserCount"
};

/** 风险明细指标键 → i18n label（后端 detail 的量化字段；未知键回退原键名） */
export const METRIC_LABEL_KEYS: Record<string, string> = {
  days: "accountRisk.metricDays",
  count: "accountRisk.metricCount",
  threshold: "accountRisk.metricThreshold",
  date_password_updated: "accountRisk.metricPasswordUpdatedAt"
};

/** 统计面板的等级 / 状态展示顺序（后端字典值之外的 key 追加在后） */
export const LEVEL_ORDER = ["high", "medium", "low"];
export const STATUS_ORDER = ["pending", "resolved", "ignored"];
export const LEVEL_LABEL_KEYS: Record<string, string> = {
  high: "accountRisk.levelHigh",
  medium: "accountRisk.levelMedium",
  low: "accountRisk.levelLow"
};
export const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "accountRisk.statusPending",
  resolved: "accountRisk.statusResolved",
  ignored: "accountRisk.statusIgnored"
};

/**
 * 风险明细的指标条目：metrics 子对象优先；后端当前为平铺结构
 * （量化字段与 description/suggestion 同级），回退取 detail 除去
 * 已单独渲染的说明/建议后的其余键。
 */
export function metricEntriesOf(detail: RecordType): Array<[string, unknown]> {
  const metrics = detail.metrics;
  if (metrics && typeof metrics === "object") {
    return Object.entries(metrics as RecordType);
  }
  return Object.entries(detail).filter(
    ([key]) =>
      key !== "description" && key !== "suggestion" && key !== "metrics"
  );
}

/** 指标值统一文本化：标量直出，复合值 JSON 序列化（避免 [object Object]） */
export function metricText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * 计数分布 → 统计面板 chip：展示顺序固定，后端多出的枚举值追加在后。
 * （纯函数；i18n 键经 translate 由调用方注入）
 */
export function chipsOf(
  source: Record<string, number>,
  order: string[],
  labelKeys: Record<string, string>,
  tagTypes: Record<string, TagType>,
  translate: (key: string) => string
): StatsChip[] {
  return [...order, ...Object.keys(source).filter(key => !order.includes(key))]
    .filter(key => source[key] !== undefined)
    .map(key => ({
      key,
      label: labelKeys[key] ? translate(labelKeys[key]) : key,
      type: tagTypes[key] ?? "info",
      count: source[key]
    }));
}

/** 取 LabeledChoiceField 的 value / label（兼容后端下发标量的情况） */
export function pick(raw: unknown) {
  if (raw && typeof raw === "object" && "value" in (raw as RecordType)) {
    const item = raw as { value: string; label?: string };
    return { value: item.value, label: item.label ?? item.value };
  }
  return { value: String(raw ?? ""), label: String(raw ?? "") };
}
