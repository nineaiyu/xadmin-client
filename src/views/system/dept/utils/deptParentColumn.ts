/**
 * 部门表单「上级部门」列装配（纯函数，自 useDept 抽出便于单测直测）：
 * 父级列改为级联选择（按 pk 提交、可选中任意层级）并用 choices 组装选项树。
 * 不持有 Vue 状态、不发起请求；装配流程见同目录 hook.tsx。
 */

import { handleTree } from "@/utils/tree";
import type { RecordType } from "plus-pro-components";

/** 弹层表单列的可编辑形状（与弹层解析器上下文同构，独立声明避免耦合内部类型） */
type ParentColumnLike = {
  fieldProps?: Record<string, unknown>;
  _column?: { choices?: unknown[] } | undefined;
  [key: string]: unknown;
};

/** 表单提交值：接口行 parent 为对象形态，提交时仅取其 pk（顶级为空串） */
export const deptParentFormValue = (rawRow?: RecordType) =>
  rawRow?.parent?.pk ?? "";

/** 上级部门列：valueType 级联 + pk/name 映射 + 允许选中任意层级（checkStrictly） */
export function applyDeptParentColumn<T extends ParentColumnLike>(
  column: T
): T {
  const target: ParentColumnLike = column;
  target["valueType"] = "cascader";
  target["fieldProps"] = {
    ...target["fieldProps"],
    ...{
      props: {
        value: "pk",
        label: "name",
        emitPath: false,
        checkStrictly: true
      }
    }
  };
  const choices = (target._column?.choices ?? []) as Array<
    Record<string, unknown>
  >;
  target["options"] = handleTree(choices, "pk", "parent_id");
  return column;
}
