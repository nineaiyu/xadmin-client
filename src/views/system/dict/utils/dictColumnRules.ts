/**
 * 数据字典弹层表单列规则（纯函数，自 useDataDict 抽出便于单测直测）：
 * 类型行隐藏「所属类型/字典值」，内置字典（is_locked）锁死编码与所属类型，
 * 新增子项时所属类型由父行决定亦不可改。不持有 Vue 状态、不发起请求；
 * 装配流程见同目录 hook.tsx。
 */

import type { RecordType } from "plus-pro-components";
import type { DictRow } from "./types";

/** 弹层表单列的可编辑形状（与弹层解析器上下文同构，独立声明避免耦合内部类型） */
type EditableFormColumn = {
  fieldProps?: Record<string, unknown>;
  [key: string]: unknown;
};

type FormColumnContext = {
  column: EditableFormColumn;
  rawRow?: RecordType;
  isAdd?: boolean;
};

/** 仅类型行可挂字典项：序列化器 parent 查询集已限定类型层，杜绝三级结构 */
export const isDictTypeRow = (row: DictRow) => !row?.parent;

/** 编码列：内置字典锁死编码——改 code 会让代码里的引用断链 */
export function dictCodeColumnTransform({ column, rawRow }: FormColumnContext) {
  if (rawRow?.is_locked) {
    column["fieldProps"] = { ...column["fieldProps"], disabled: true };
  }
  return column;
}

/** 所属类型列：类型行隐藏；内置字典与新增子项（所属类型由父行决定）锁死 */
export function dictParentColumnTransform({
  column,
  rawRow,
  isAdd
}: FormColumnContext) {
  // 类型行没有「所属类型」概念（新建时留空即创建类型层）
  if (isDictTypeRow(rawRow as DictRow)) {
    column["hideInForm"] = true;
    return column;
  }
  // 内置字典锁死所属类型；新增子项时所属类型由父行决定，也不可改
  if (rawRow?.is_locked || (isAdd && rawRow?.parent)) {
    column["fieldProps"] = { ...column["fieldProps"], disabled: true };
  }
  return column;
}

/** 字典值列：仅字典项使用，类型行隐藏 */
export function dictValueColumnTransform({
  column,
  rawRow
}: FormColumnContext) {
  if (isDictTypeRow(rawRow as DictRow)) column["hideInForm"] = true;
  return column;
}
