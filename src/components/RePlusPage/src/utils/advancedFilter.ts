/**
 * 高级筛选：字段能力推导、条件行联动、参数拼装与回显（纯函数，单测出口）。
 *
 * 与后端 `ControlledLookupFilterBackend` 同口径：
 * - 参数形态 `?field__lookup=value`；`in` 的多值以英文逗号拼成**单参数**
 *   （后端按 `query_params.get()` 取单值再 split，重复参数只会命中第一个）；
 * - lookup 白名单逐字对齐，并按字段值形态二次收敛（不给出后端必然拒绝的选项）；
 * - `isnull` 传布尔字面量、`ne` 为取反（其余按字符串原样下发）。
 *
 * 字段能力（值控件形态 / 选项 / 可用条件）由列表列元数据推导，用于把
 * 「字段 → 条件 → 取值」联动展开：选择型给下拉、日期给选择器、多值给多选。
 */

import type { PageColumn } from "./types";

/** 支持的 lookup（顺序即兜底下拉顺序；icontains 为文本默认） */
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

/** 取值控件形态（由字段 input_type / choices 推导） */
export type LookupFieldKind =
  "text" | "number" | "boolean" | "date" | "datetime" | "time" | "choice";

/** 选项条目（选择型字段的候选取值） */
export type LookupOption = { value: string; label: string };

/** 字段候选及其联动能力 */
export type LookupFieldFacet = {
  /** 字段名（查询参数前缀，即列的 prop） */
  value: string;
  label: string;
  kind: LookupFieldKind;
  /** 多值字段（m2m / multiple）：取值控件与默认条件按多值形态展开 */
  multiple: boolean;
  options: LookupOption[];
  /** 后端下发的可用条件 ∩ 值形态白名单（顺序即下拉顺序） */
  lookups: LookupName[];
  defaultLookup: LookupName;
};

/** 一条高级筛选条件行（value 承载标量、values 承载多值） */
export type LookupRow = {
  field: string;
  lookup: LookupName;
  value: string;
  values: string[];
};

/** 条件行校验错误（由调用方按 i18n 文案渲染） */
export type LookupErrorCode = "field" | "value" | "duplicate";
export type LookupError = { index: number; code: LookupErrorCode };

export const EMPTY_LOOKUP_ROW: LookupRow = {
  field: "",
  lookup: DEFAULT_LOOKUP,
  value: "",
  values: []
};

/** input_type → 取值形态（未收录的类型按自由文本处理） */
const KIND_BY_INPUT_TYPE: Record<string, LookupFieldKind> = {
  string: "text",
  text: "text",
  textarea: "text",
  email: "text",
  phone: "text",
  color: "text",
  url: "text",
  password: "text",
  integer: "number",
  number: "number",
  float: "number",
  decimal: "number",
  boolean: "boolean",
  switch: "boolean",
  date: "date",
  datetime: "datetime",
  datetimerange: "datetime",
  time: "time",
  select: "choice",
  "select-multiple": "choice",
  "select-ordering": "choice",
  labeled_choice: "choice",
  choice: "choice",
  labeled_multiple_choice: "choice",
  "multiple choice": "choice",
  object_related_field: "choice",
  m2m_related_field: "choice",
  object_related_field_file: "choice",
  m2m_related_field_file: "choice"
};

/** 值形态 → 可用条件（与后端 available_lookups 的同类型白名单求交） */
const LOOKUPS_BY_KIND: Record<LookupFieldKind, LookupName[]> = {
  text: ["icontains", "exact", "startswith", "in", "isnull", "ne"],
  number: ["exact", "in", "gte", "lte", "isnull", "ne"],
  date: ["exact", "gte", "lte", "isnull", "ne"],
  datetime: ["exact", "gte", "lte", "isnull", "ne"],
  time: ["exact", "gte", "lte", "isnull", "ne"],
  boolean: ["exact", "ne", "isnull"],
  choice: ["exact", "in", "ne", "isnull"]
};

/** 值形态 → 默认条件（选中字段后自动生效，用户可在下拉里改） */
const DEFAULT_LOOKUP_BY_KIND: Record<LookupFieldKind, LookupName> = {
  text: "icontains",
  number: "exact",
  date: "gte",
  datetime: "gte",
  time: "gte",
  boolean: "exact",
  choice: "exact"
};

/** 多值字段默认走「属于」（一次选多个选项 / 多个 ID） */
const MULTIPLE_DEFAULT_LOOKUP: LookupName = "in";

const normalizeOptions = (column: PageColumn | undefined): LookupOption[] => {
  const choices = column?._column?.choices ?? [];
  const options: LookupOption[] = [];
  choices.forEach(item => {
    const value = String(item?.value ?? item?.pk ?? "").trim();
    if (!value) return;
    const label = String(item?.label ?? item?.name ?? value);
    if (options.some(option => option.value === value)) return;
    options.push({ value, label });
  });
  return options;
};

/**
 * 列元数据 → 高级筛选字段候选（仅保留后端下发 lookups 的列）。
 *
 * 未下发 lookups 的列在后端会直接 400（字段不在 filterset 声明面或无字段权限），
 * 因此不能进入候选。
 */
export function buildLookupFields(columns: PageColumn[]): LookupFieldFacet[] {
  const fields: LookupFieldFacet[] = [];
  columns.forEach(column => {
    if (column.type) return;
    // 查询字段名取元数据 key，而不是列的 prop：详情渲染器会把列表列 prop 改写成
    // `gender.value` / `dept.pk` 这类取值路径（renderers-detail 的 labeled_choice /
    // object_related_field 分支），而受控 lookup 参数必须用接口字段名下发
    // （与后端 filterset 白名单同源，否则必然 400）
    const prop = String(column._column?.key ?? column.prop ?? "").trim();
    if (!prop || prop === "operation") return;
    const declared = (column.lookups ?? []).filter((item): item is LookupName =>
      (LOOKUP_OPTIONS as readonly string[]).includes(item)
    );
    if (!declared.length) return;
    const inputType = String(column._column?.input_type ?? "");
    const options = normalizeOptions(column);
    let kind = KIND_BY_INPUT_TYPE[inputType] ?? "text";
    // 选择型但后端未下发选项（如未声明 choices 的关联列）：退化为自由文本，
    // 避免给出「没有选项的下拉」；值仍按后端 to_python（多为主键 / 名称）校验
    if (kind === "choice" && !options.length) kind = "text";
    const multiple =
      column._column?.multiple === true ||
      inputType.includes("multiple") ||
      inputType.startsWith("m2m_");
    const allowed = LOOKUPS_BY_KIND[kind].filter(item =>
      declared.includes(item)
    );
    const lookups = allowed.length ? allowed : declared;
    const defaultLookup =
      multiple && lookups.includes(MULTIPLE_DEFAULT_LOOKUP)
        ? MULTIPLE_DEFAULT_LOOKUP
        : lookups.includes(DEFAULT_LOOKUP_BY_KIND[kind])
          ? DEFAULT_LOOKUP_BY_KIND[kind]
          : lookups[0];
    fields.push({
      value: prop,
      label: String(column.label ?? prop),
      kind,
      multiple,
      options,
      lookups,
      defaultLookup
    });
  });
  return fields;
}

/** 字段名 → 候选（未命中返回 undefined，回显未知字段时由调用方补 facet） */
export function findLookupField(
  fields: LookupFieldFacet[],
  field: string
): LookupFieldFacet | undefined {
  return fields.find(item => item.value === String(field ?? ""));
}

/** 字段可用条件（未命中字段时回落全量白名单） */
export function lookupsForField(
  fields: LookupFieldFacet[],
  field: string
): LookupName[] {
  const facet = findLookupField(fields, field);
  return facet ? facet.lookups : [...LOOKUP_OPTIONS];
}

/** 字段默认条件（未命中字段时回落 icontains） */
export function defaultLookupForField(
  fields: LookupFieldFacet[],
  field: string
): LookupName {
  return findLookupField(fields, field)?.defaultLookup ?? DEFAULT_LOOKUP;
}

/** 切换字段后修正不兼容的条件（如文本的「包含」在布尔字段上不存在） */
export function normalizeLookupForField(
  fields: LookupFieldFacet[],
  row: LookupRow,
  fallback?: LookupName
): LookupRow {
  const allowed = lookupsForField(fields, row.field);
  if (allowed.includes(row.lookup)) return row;
  const preferred = fallback ?? defaultLookupForField(fields, row.field);
  return {
    ...row,
    lookup: allowed.includes(preferred) ? preferred : allowed[0]
  };
}

/** lookup 是否无需字符输入（isnull 用「是 / 否」下拉） */
export const isBooleanLookup = (lookup: LookupName) => lookup === "isnull";

/** 收集条件行的多值（优先 values 数组，回显/手输形态回落到逗号拆分） */
export function collectLookupValues(row: LookupRow): string[] {
  const fromValues = (row.values ?? [])
    .map(item => String(item ?? "").trim())
    .filter(Boolean);
  if (fromValues.length) return Array.from(new Set(fromValues));
  return Array.from(
    new Set(
      String(row.value ?? "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

/**
 * 单个条件行的值 → 查询参数值；返回 null 表示该行取值缺失（由调用方报错）。
 *
 * 多值统一拼为英文逗号分隔的**单参数**：后端 `query_params.get()` 取单值后 split，
 * 数组序列化出的重复参数只会命中第一个（历史缺陷）。
 */
export function normalizeRowValue(row: LookupRow): unknown | null {
  if (row.lookup === "isnull") {
    if (row.value === "true") return true;
    if (row.value === "false") return false;
    return null;
  }
  if (row.lookup === "in") {
    const items = collectLookupValues(row);
    return items.length ? items.join(",") : null;
  }
  const value = String(row.value ?? "").trim();
  return value ? value : null;
}

/** 空行判定：字段、取值、非默认条件任意一项填写即为有效行 */
export function isEmptyLookupRow(row: LookupRow): boolean {
  return (
    !String(row.field ?? "").trim() &&
    !String(row.value ?? "").trim() &&
    !(row.values ?? []).length &&
    row.lookup === DEFAULT_LOOKUP
  );
}

/**
 * 条件行集合 → 请求参数。
 *
 * @returns params 为 `{ "field__lookup": value }`；errors 为逐行错误（不阻断其它行）
 */
export function buildLookupParams(rows: LookupRow[]): {
  params: Record<string, unknown>;
  errors: LookupError[];
} {
  const params: Record<string, unknown> = {};
  const errors: LookupError[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const field = String(row.field ?? "").trim();
    if (!field) {
      errors.push({ index, code: "field" });
      return;
    }
    const lookup = (row.lookup ?? DEFAULT_LOOKUP) as LookupName;
    const key = `${field}__${lookup}`;
    if (seen.has(key)) {
      errors.push({ index, code: "duplicate" });
      return;
    }
    const value = normalizeRowValue(row);
    if (value === null) {
      errors.push({ index, code: "value" });
      return;
    }
    seen.add(key);
    params[key] = value;
  });
  return { params, errors };
}

/** 回显解析结果：rows 为条件行，extraFields 为已不在候选里的历史字段 */
export type ParsedLookupConditions = {
  rows: LookupRow[];
  extraFields: LookupFieldFacet[];
};

/**
 * 从搜索条件快照中还原高级筛选行（编辑弹窗打开时带上已生效条件）。
 *
 * 只识别「字段名不含嵌套」且 lookup 在白名单内的键；数组值回填多值形态。
 */
export function parseLookupConditions(
  conditions: Record<string, unknown> | undefined,
  fields: LookupFieldFacet[] = []
): ParsedLookupConditions {
  const rows: LookupRow[] = [];
  const extraFields: LookupFieldFacet[] = [];
  Object.entries(conditions ?? {}).forEach(([key, value]) => {
    const separator = key.lastIndexOf("__");
    if (separator <= 0) return;
    const field = key.slice(0, separator);
    const lookup = key.slice(separator + 2) as LookupName;
    if (!LOOKUP_OPTIONS.includes(lookup) || field.includes("__")) return;
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    const row: LookupRow = {
      field,
      lookup,
      value: "",
      values: []
    };
    if (lookup === "isnull") {
      row.value = String(Boolean(value));
    } else if (Array.isArray(value)) {
      row.values = value.map(item => String(item));
    } else if (typeof value === "object") {
      return;
    } else {
      row.value = String(value);
      if (lookup === "in") {
        row.values = collectLookupValues(row);
        row.value = "";
      }
    }
    if (isEmptyLookupRow(row)) return;
    if (!findLookupField(fields, field)) {
      extraFields.push({
        value: field,
        label: field,
        kind: "text",
        multiple: row.values.length > 0,
        options: [],
        lookups: [...LOOKUP_OPTIONS],
        defaultLookup: lookup
      });
    }
    rows.push(row);
  });
  return { rows, extraFields };
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
