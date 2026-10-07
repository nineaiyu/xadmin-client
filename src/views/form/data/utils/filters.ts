import type { DictItem } from "@/utils/dict";
import type {
  FormCascaderOption,
  FormField,
  FormFieldType
} from "@/api/dataset/dform";

/**
 * 「表单数据」页字段筛选（物化筛选列）的纯函数装配。
 *
 * 筛选口径与服务端同源：只有设计器勾选 `filterable` 且类型可渲染筛选控件的字段
 * 出现在筛选面；条件以 JSON 字符串随列表/导出请求下发（`filter_data`），
 * 服务端按所选表单的当前 schema fail-closed 校验并按 JSON 包含语义过滤。
 * 选人字段走远程搜索（取值=用户主键，多选为数组）、级联字段走选项树
 * （取值=整条叶子路径），形态与服务端 `coerce_filter_value` 的规范化口径一致。
 */
export const FILTER_UI_TYPES: FormFieldType[] = [
  "input",
  "textarea",
  "number",
  "amount",
  "select",
  "radio",
  "checkbox",
  "date",
  "switch",
  "user",
  "cascader",
  // 公式字段后端物化为文本型筛选列（FILTERABLE_TYPES 允许），筛选栏按文本输入渲染
  "formula"
];

const OPTIONED_TYPES: FormFieldType[] = ["select", "radio", "checkbox"];

/** 可筛选字段（保持 schema 字段顺序） */
export function filterableFieldsOf(fields: FormField[]): FormField[] {
  return fields.filter(
    field => field.filterable && FILTER_UI_TYPES.includes(field.type)
  );
}

/** 空值不参与条件：注意 false（开关）与 0（数字）是有效取值 */
export function isEmptyFilterValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * 收集非空筛选条件为请求参数（JSON 字符串）。
 *
 * 无可筛条件返回空串（调用方据此从请求中剔除 `filter_data`）；取值不做类型改写，
 * 由服务端按字段类型规范化（数字/布尔/多值包数组）。
 */
export function buildFilterPayload(
  fields: FormField[],
  values: Record<string, unknown>
): string {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (isEmptyFilterValue(value)) continue;
    payload[field.key] = value;
  }
  return Object.keys(payload).length ? JSON.stringify(payload) : "";
}

export function isOptionedField(field: FormField): boolean {
  return OPTIONED_TYPES.includes(field.type);
}

export function isNumberField(field: FormField): boolean {
  return field.type === "number" || field.type === "amount";
}

export function isUserField(field: FormField): boolean {
  return field.type === "user";
}

export function isCascaderField(field: FormField): boolean {
  return field.type === "cascader";
}

/** 级联字段的树形选项（平铺字符串项忽略） */
export function cascaderOptionsOf(field: FormField): FormCascaderOption[] {
  return (field.options ?? []).filter(
    (item): item is FormCascaderOption => typeof item !== "string"
  );
}

/** 筛选下拉候选项：字典优先（读字典项缓存），否则内联选项（平铺字符串数组） */
export function filterOptionsOf(
  field: FormField,
  dictItems: DictItem[] | undefined
): { label: string; value: string }[] {
  if (field.dict) {
    return (dictItems ?? []).map(item => ({
      label: item.label,
      value: String(item.value ?? "")
    }));
  }
  return (field.options ?? [])
    .filter((item): item is string => typeof item === "string")
    .map(item => ({ label: item, value: item }));
}
