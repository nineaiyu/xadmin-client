import type { RecordType } from "plus-pro-components";

/** cron 五字段 + 时区的表单草稿（合成字段，提交前拆回独立字段） */
export type CronDraft = {
  minute: string;
  hour: string;
  day_of_month: string;
  month_of_year: string;
  day_of_week: string;
  timezone: string;
};

export const CRON_FIELD_KEYS = [
  "minute",
  "hour",
  "day_of_month",
  "month_of_year",
  "day_of_week",
  "timezone"
] as const;

const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** 编辑回显 / 新增默认值：缺失字段按 cron 的 * 与浏览器时区兜底 */
export function cronDraftFromRow(row?: RecordType | null): CronDraft {
  const source = (row ?? {}) as Record<string, unknown>;
  return {
    minute: String(source.minute ?? "*"),
    hour: String(source.hour ?? "*"),
    day_of_month: String(source.day_of_month ?? "*"),
    month_of_year: String(source.month_of_year ?? "*"),
    day_of_week: String(source.day_of_week ?? "*"),
    timezone: String(source.timezone ?? browserTimezone())
  };
}

/** 合成字段拆回独立字段；合成字段本身不进入载荷 */
export function applyCronDraft(
  formData: RecordType,
  value: unknown
): RecordType {
  const draft = cronDraftFromRow(value as RecordType);
  for (const key of CRON_FIELD_KEYS) formData[key] = draft[key];
  delete formData.cron_expression;
  return formData;
}
