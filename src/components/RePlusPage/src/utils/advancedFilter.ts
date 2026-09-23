/**
 * 高级筛选：受控 lookup 条件行的拼装与回显（纯函数，单测出口）。
 *
 * 与后端 `ControlledLookupFilterBackend` 同口径：
 * - 参数形态 `?field__lookup=value`；
 * - lookup 白名单逐字对齐（禁跨关系 `a__b__`）；
 * - `in` 传数组、`isnull` 传布尔字面量、`ne` 为取反（其余按字符串原样下发）。
 */

/** 支持的 lookup（顺序即下拉顺序；icontains 为默认） */
export const LOOKUP_OPTIONS = [
  "icontains",
  "exact",
  "startswith",
  "in",
  "gte",
  "lte",
  "isnull",
  "ne"
] as const;

export type LookupName = (typeof LOOKUP_OPTIONS)[number];

export const DEFAULT_LOOKUP: LookupName = "icontains";

/** 一条高级筛选条件行 */
export type LookupRow = {
  field: string;
  lookup: LookupName;
  value: string;
};

export const EMPTY_LOOKUP_ROW: LookupRow = {
  field: "",
  lookup: DEFAULT_LOOKUP,
  value: ""
};

/** lookup 是否无需输入值（isnull 用布尔下拉） */
export const isBooleanLookup = (lookup: LookupName) => lookup === "isnull";

/** 单个条件行的值 → 查询参数值；非法返回 null（由调用方按错误处理） */
export function normalizeLookupValue(
  lookup: LookupName,
  raw: string
): unknown | null {
  const value = String(raw ?? "").trim();
  if (lookup === "isnull") {
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  if (!value) return null;
  if (lookup === "in") {
    const items = value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  return value;
}

/**
 * 条件行集合 → 请求参数。
 *
 * @returns params 为 `{ "field__lookup": value }`；errors 为逐行可读错误（不阻断其它行）
 */
export function buildLookupParams(rows: LookupRow[]): {
  params: Record<string, unknown>;
  errors: string[];
} {
  const params: Record<string, unknown> = {};
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const field = String(row.field ?? "").trim();
    const lookup = (row.lookup ?? DEFAULT_LOOKUP) as LookupName;
    const label = `#${index + 1}`;
    if (!field) {
      errors.push(`${label}: field is required`);
      return;
    }
    const key = `${field}__${lookup}`;
    if (params[key] !== undefined) {
      errors.push(`${label}: duplicated condition ${key}`);
      return;
    }
    const value = normalizeLookupValue(lookup, row.value);
    if (value === null) {
      errors.push(`${label}: value is required`);
      return;
    }
    params[key] = value;
  });
  return { params, errors };
}

/**
 * 从搜索条件快照中还原高级筛选行（回显：编辑弹窗打开时带上已生效条件）。
 *
 * 只识别「字段名不含 `__lookup` 之外的嵌套」且 lookup 在白名单内的键，
 * 数组值回填为逗号分隔字符串。
 */
export function parseLookupConditions(
  conditions: Record<string, unknown> | undefined
): LookupRow[] {
  const rows: LookupRow[] = [];
  Object.entries(conditions ?? {}).forEach(([key, value]) => {
    const separator = key.lastIndexOf("__");
    if (separator <= 0) return;
    const field = key.slice(0, separator);
    const lookup = key.slice(separator + 2) as LookupName;
    if (!LOOKUP_OPTIONS.includes(lookup) || field.includes("__")) return;
    if (["created_time", "updated_time"].includes(field)) return;
    let text = "";
    if (Array.isArray(value)) {
      text = value.join(",");
    } else if (typeof value === "boolean") {
      text = String(value);
    } else if (value !== null && value !== undefined && value !== "") {
      text = String(value);
    } else {
      return;
    }
    rows.push({ field, lookup, value: text });
  });
  return rows;
}

/** 清除搜索条件中的高级筛选键（应用新条件前先清旧值） */
export function stripLookupConditions(
  conditions: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...conditions };
  Object.keys(result).forEach(key => {
    const separator = key.lastIndexOf("__");
    if (separator <= 0) return;
    const lookup = key.slice(separator + 2) as LookupName;
    if (LOOKUP_OPTIONS.includes(lookup)) delete result[key];
  });
  return result;
}
