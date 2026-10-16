/**
 * 「我的视图」条件摘要：把保存的搜索条件翻译成可读文本（纯函数，单测出口）。
 *
 * 用途：视图列表 / 保存弹窗里展示「这个视图筛了什么」——
 * 选择型字段回显选项标签、高级筛选带上条件词（如「性别 等于 男」）。
 */

import {
  LOOKUP_OPTIONS,
  buildLookupFields,
  collectLookupValues,
  findLookupField,
  parseLookupConditions,
  type LookupFieldFacet
} from "./advancedFilter";
import type { PageColumn } from "./types";

/** i18n 翻译函数的最小契约（与 vue-i18n 的 t 兼容） */
export type SummaryTranslator = (
  key: string,
  named?: Record<string, unknown>
) => string;

/** 单条筛选条件的可读拆解 */
export type ConditionSummaryItem = {
  label: string;
  /** 高级筛选的条件词（普通搜索条件为空） */
  operator?: string;
  value: string;
};

const NON_FILTER_KEYS = ["page", "size", "ordering"];

/** 值文本：选项回显标签、布尔回显是/否、其余原样 */
function displayValue(
  facet: LookupFieldFacet | undefined,
  value: unknown,
  t: SummaryTranslator
): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const hit = facet?.options.find(option => option.value === text);
  if (hit) return hit.label;
  if (facet?.kind === "boolean") {
    if (text === "true") return t("advancedFilter.true");
    if (text === "false") return t("advancedFilter.false");
  }
  return text;
}

function displayAny(
  facet: LookupFieldFacet | undefined,
  value: unknown,
  t: SummaryTranslator
): string {
  if (Array.isArray(value)) {
    return value
      .map(item => displayValue(facet, item, t))
      .filter(Boolean)
      .join("、");
  }
  if (value !== null && typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }
  return displayValue(facet, value, t);
}

/**
 * 条件快照 → 可读摘要条目。
 *
 * `columns` 取列表列元数据（用于字段标签与选项标签），未命中时回退字段名 / 原始值。
 */
export function summarizeConditions(
  conditions: Record<string, unknown> | undefined,
  columns: PageColumn[],
  t: SummaryTranslator
): ConditionSummaryItem[] {
  const fields = buildLookupFields(columns);
  const parsed = parseLookupConditions(conditions, fields);
  const all = [...parsed.extraFields, ...fields];
  const items: ConditionSummaryItem[] = parsed.rows.map(row => {
    const facet = findLookupField(all, row.field);
    const operator = t(`advancedFilter.lookups.${row.lookup}`);
    if (row.lookup === "isnull") {
      return {
        label: facet?.label ?? row.field,
        operator,
        value:
          row.value === "false"
            ? t("advancedFilter.false")
            : t("advancedFilter.true")
      };
    }
    if (row.lookup === "in") {
      return {
        label: facet?.label ?? row.field,
        operator,
        value: collectLookupValues(row)
          .map(item => displayValue(facet, item, t))
          .filter(Boolean)
          .join("、")
      };
    }
    return {
      label: facet?.label ?? row.field,
      operator,
      value: displayValue(facet, row.value, t)
    };
  });
  // 普通搜索条件（非受控 lookup 键）：字段名可能来自搜索区而非表格列
  Object.entries(conditions ?? {}).forEach(([key, value]) => {
    if (NON_FILTER_KEYS.includes(key)) return;
    const separator = key.lastIndexOf("__");
    const lookup = separator > 0 ? key.slice(separator + 2) : "";
    if ((LOOKUP_OPTIONS as readonly string[]).includes(lookup)) return;
    const facet = findLookupField(all, key);
    const text = displayAny(facet, value, t);
    if (!text) return;
    items.push({ label: facet?.label ?? key, value: text });
  });
  return items;
}

/** 摘要条目 → 单行文本（列表项的第二行展示） */
export function summarizeConditionsText(items: ConditionSummaryItem[]): string {
  return items
    .map(item =>
      item.operator
        ? `${item.label} ${item.operator}${item.value ? ` ${item.value}` : ""}`
        : `${item.label}：${item.value}`
    )
    .join(" · ");
}
