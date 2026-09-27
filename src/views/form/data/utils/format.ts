import type { FormField } from "@/api/dataset/dform";

/**
 * 表单字段值的列表展示口径（管理端「表单数据」动态列）。
 *
 * 纯函数 + 可注入解析器：字典项（异步拉取）与选人回显（批量请求）由页面侧提供，
 * 其余形态（数组 / 附件 / 明细子表行数）在此归一，便于单测覆盖。
 */
export type FieldValueResolvers = {
  /** 字典值 → 展示文本（未命中返回 undefined，回落内联选项与原始值） */
  option?: (field: FormField, value: unknown) => string | undefined;
  /** 选人 pk → 展示名（未命中返回 undefined，回落 pk） */
  user?: (pk: string) => string | undefined;
  /** 布尔文案（switch 控件：是 / 否） */
  booleanText?: (value: boolean) => string;
  /** 明细子表行数文案（如「3 行」） */
  tableRows?: (count: number) => string;
  /** 空值占位（缺省 "-"） */
  emptyText?: string;
};

/** 内联选项（schema options，字符串数组或 {value,label} 节点）→ 展示文本 */
export function inlineOptionLabel(
  field: FormField,
  value: unknown
): string | undefined {
  for (const option of field.options ?? []) {
    if (typeof option === "string") {
      if (option === value) return option;
      continue;
    }
    if (String(option.value) === String(value)) return option.label;
  }
  return undefined;
}

export function fieldValueText(
  field: FormField,
  value: unknown,
  resolvers: FieldValueResolvers = {}
): string {
  const empty = resolvers.emptyText ?? "-";
  if (value === null || value === undefined || value === "") return empty;
  switch (field.type) {
    case "switch":
      return resolvers.booleanText
        ? resolvers.booleanText(Boolean(value))
        : value
          ? "true"
          : "false";
    case "checkbox":
    case "daterange":
      return Array.isArray(value)
        ? value.map(item => String(item)).join("、") || empty
        : String(value);
    case "cascader":
      return Array.isArray(value)
        ? value.map(item => String(item)).join(" / ")
        : String(value);
    case "table": {
      const count = Array.isArray(value) ? value.length : 0;
      if (!count) return empty;
      return resolvers.tableRows ? resolvers.tableRows(count) : String(count);
    }
    case "upload": {
      const names = (Array.isArray(value) ? value : [value])
        .map(item =>
          typeof item === "object" && item !== null
            ? String((item as { filename?: string }).filename ?? "")
            : String(item)
        )
        .filter(Boolean);
      return names.length ? names.join("、") : empty;
    }
    case "user": {
      const pks = (Array.isArray(value) ? value : [value])
        .map(item => String(item))
        .filter(Boolean);
      return pks.map(pk => resolvers.user?.(pk) ?? pk).join("、") || empty;
    }
    case "select":
    case "radio": {
      const mapped =
        resolvers.option?.(field, value) ?? inlineOptionLabel(field, value);
      return mapped ?? String(value);
    }
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}
