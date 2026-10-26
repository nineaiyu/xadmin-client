/** 提交数据展示（纯函数）：对象/数组按可读文本归一，并做长度收敛。 */

export type SubmissionTextOptions = {
  /** 空值占位（缺省 "-"） */
  emptyText?: string;
  /** 明细子表行数文案（缺省「N 行」） */
  tableRows?: (count: number) => string;
  /** 最大字符数；0 = 不截断（缺省 160） */
  maxLength?: number;
};

const DEFAULT_MAX_LENGTH = 160;

const isAttachment = (
  value: unknown
): value is { filename?: string; name?: string } =>
  typeof value === "object" &&
  value !== null &&
  ("filename" in value || "name" in value);

function valueText(value: unknown, options: SubmissionTextOptions): string {
  const empty = options.emptyText ?? "-";
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value)) {
    if (!value.length) return empty;
    if (value.every(isAttachment)) {
      const names = value
        .map(item => String(item.filename ?? item.name ?? ""))
        .filter(Boolean);
      return names.length ? names.join("、") : empty;
    }
    // 对象数组按明细子表处理（上传附件已在上方分流），只给行数避免整表 JSON 撑爆单元格
    if (value.every(item => typeof item === "object" && item !== null)) {
      const rows = options.tableRows ?? (count => `${count} 行`);
      return rows(value.length);
    }
    return value.map(item => String(item)).join("、") || empty;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const submissionDataText = (
  data: Record<string, unknown>,
  options: SubmissionTextOptions = {}
) => {
  const entries = Object.entries(data ?? {}).map(
    ([key, value]) => `${key}: ${valueText(value, options)}`
  );
  const result = entries.join(" | ") || (options.emptyText ?? "-");
  const max = options.maxLength ?? DEFAULT_MAX_LENGTH;
  return max > 0 && result.length > max ? `${result.slice(0, max)}…` : result;
};
