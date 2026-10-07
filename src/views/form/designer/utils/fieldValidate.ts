import type { FormField } from "@/api/dataset/dform";

/**
 * 字段行的客户端校验（保存兜底与字段表行内编辑的即时反馈共用同一实现，
 * 规则与属性弹窗 / 服务端同口径）。类型与公式等复杂规则仍由属性弹窗校验。
 */

/** 字段标识规则：小写字母开头，字母/数字/下划线，≤32 位 */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

export type FieldRowError = "keyInvalid" | "keyDuplicated" | "labelRequired";

/** 单行校验（key 唯一性按整表判定；key 不做 trim，行内误输入空格即非法） */
export function fieldRowErrorOf(
  field: FormField,
  fields: FormField[]
): FieldRowError | null {
  const key = field.key ?? "";
  if (!FIELD_KEY_RE.test(key)) return "keyInvalid";
  if (fields.filter(item => (item.key ?? "") === key).length > 1)
    return "keyDuplicated";
  if (!(field.label ?? "").trim()) return "labelRequired";
  return null;
}

/** 整表校验（保存前兜底）：返回首个出错行的下标与错误种类，全部合法返回 null */
export function findFieldError(
  fields: FormField[]
): { index: number; error: FieldRowError } | null {
  for (let index = 0; index < fields.length; index++) {
    const error = fieldRowErrorOf(fields[index], fields);
    if (error) return { index, error };
  }
  return null;
}
