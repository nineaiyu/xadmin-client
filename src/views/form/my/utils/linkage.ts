import type { FormField, FormLinkage } from "@/api/dataset/dform";

/**
 * 表单联动求值（与后端 `dataset/utils/dform.py::evaluate_linkages` 同口径）。
 *
 * - 规则：`{target, field, op, value?, effect}`；命中判定按触发字段当前取值；
 * - 求值：按数组顺序**后者覆盖前者**（隐藏与必填两个维度独立覆盖），
 *   未命中任何规则 = 沿用字段自身定义（required 为 null）；
 * - 展示层只做「隐藏 + 必填」；提交落库口径由后端同一份规则保证。
 */

export type FieldControl = {
  hidden: boolean;
  /** null = 沿用字段自身 required；true/false = 规则覆盖 */
  required: boolean | null;
};

const scalar = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isInteger(value))
    return String(value);
  return String(value);
};

const isEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

export const matchesLinkage = (rule: FormLinkage, value: unknown): boolean => {
  if (rule.op === "empty") return isEmpty(value);
  if (rule.op === "notempty") return !isEmpty(value);
  const expected = Array.isArray(rule.value) ? rule.value : [rule.value];
  const expectedSet = new Set(expected.map(item => scalar(item)));
  const matched = Array.isArray(value)
    ? value.some(item => expectedSet.has(scalar(item)))
    : expectedSet.has(scalar(value));
  if (rule.op === "eq" || rule.op === "in") return matched;
  if (rule.op === "ne" || rule.op === "notin") return !matched;
  return false;
};

export function evaluateLinkages(
  fields: FormField[],
  linkages: FormLinkage[] | undefined,
  data: Record<string, unknown>
): Record<string, FieldControl> {
  const controls: Record<string, FieldControl> = {};
  for (const field of fields) {
    controls[field.key] = { hidden: false, required: null };
  }
  for (const rule of linkages ?? []) {
    const control = controls[rule.target];
    if (!control || !controls[rule.field]) continue;
    if (!matchesLinkage(rule, data[rule.field])) continue;
    switch (rule.effect) {
      case "hide":
        control.hidden = true;
        break;
      case "show":
        control.hidden = false;
        break;
      case "require":
        control.required = true;
        break;
      case "optional":
        control.required = false;
        break;
    }
  }
  return controls;
}

/** 展示用字段清单（隐藏字段不渲染；后端提交校验同样跳过隐藏字段） */
export function visibleFields(
  fields: FormField[],
  controls: Record<string, FieldControl>
): FormField[] {
  return fields.filter(field => !controls[field.key]?.hidden);
}

/** 字段是否必填：联动 require/optional 覆盖字段自身定义 */
export function isFieldRequired(
  field: FormField,
  controls: Record<string, FieldControl>
): boolean {
  const override = controls[field.key]?.required;
  return override === null || override === undefined
    ? Boolean(field.required)
    : override;
}
