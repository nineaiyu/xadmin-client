import type { FormField, FormFieldType } from "@/api/dataset/dform";

/**
 * 控件类型 → 属性收敛（单一事实源）：字段表行内改类型与属性弹窗确认共用。
 *
 * 清除与当前控件类型无关的属性，避免 schema 携带后端会拒绝的残留键——
 * 典型现场：行内把 select 改成 input 后残留 options，保存被后端拒绝
 * （「Field ... does not accept options」），用户滞留弹窗无法保存。
 * 清单与后端 dataset/utils/dform.py 的校验口径一一对应。
 */

const TEXT_TYPES: FormFieldType[] = ["input", "textarea"];
const NUMBER_TYPES: FormFieldType[] = ["number", "amount"];
const OPTIONED_TYPES: FormFieldType[] = ["select", "radio", "checkbox"];
/** 可携带 filterable 的控件类型（与服务端 FILTERABLE_TYPES 同口径） */
const FILTERABLE_TYPES: FormFieldType[] = [
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
  "formula"
];

const hasFlatOptions = (field: FormField) =>
  (field.options ?? []).some(item => typeof item !== "string");
const hasTreeOptions = (field: FormField) =>
  (field.options ?? []).some(item => typeof item === "string");

/**
 * 就地收敛字段属性（删除与 type 不匹配的键），返回同一字段对象。
 * 调用方语义：行内编辑直接改 row；属性弹窗在确认时对副本调用。
 */
export function convergeFieldAttributes(field: FormField): FormField {
  const { type } = field;
  const isText = TEXT_TYPES.includes(type);
  const isNumber = NUMBER_TYPES.includes(type);
  const isOptioned = OPTIONED_TYPES.includes(type);
  const isFormula = type === "formula";

  if (!isText) delete field.max_length;
  if (!isNumber) {
    delete field.min;
    delete field.max;
  }
  if (!["amount", "formula"].includes(type)) delete field.precision;
  if (type !== "user") delete field.multiple;
  if (type !== "table") delete field.columns;
  if (!isFormula) {
    delete field.formula;
  } else {
    // 计算字段只读：不可必填；展示精度缺省 2（后端同口径）
    delete field.required;
    if (field.precision === undefined) field.precision = 2;
  }
  if (!FILTERABLE_TYPES.includes(type) || !field.filterable)
    delete field.filterable;

  if (isOptioned) {
    const dict = (field.dict ?? "").trim();
    if (dict) {
      // 字典与内联选项互斥（后端同口径）：绑定字典时清空内联选项
      field.dict = dict;
      field.options = [];
    } else {
      delete field.dict;
      // 平铺选项控件只接受字符串数组：从级联切来时形态不符，清空待重填
      if (hasFlatOptions(field)) delete field.options;
    }
  } else {
    delete field.dict;
    if (type === "cascader") {
      // 级联选项是树形节点数组：从平铺控件切来时形态不符，清空待重填
      if (hasTreeOptions(field)) delete field.options;
    } else {
      delete field.options;
    }
  }
  return field;
}
