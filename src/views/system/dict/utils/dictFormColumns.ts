import {
  dictCodeColumnTransform,
  dictParentColumnTransform,
  dictValueColumnTransform
} from "./dictColumnRules";
import type { RePlusPageProps } from "@/components/RePlusPage";

/** 弹层表单列规格（与 RePlusPage 内部 ColumnSpec 同源，取 props.columns 的形参类型） */
type ColumnsSpec = NonNullable<
  NonNullable<RePlusPageProps["addOrEditOptions"]>["props"]
>["columns"];

/**
 * 数据字典新增/编辑弹窗列调整（自 hook.tsx 抽出）：主键与系统内置标记不进
 * 表单，类型行隐藏「所属类型/字典值」，内置字典（is_locked）锁死编码与所属
 * 类型——改 code 会让代码里的引用断链（转换规则见 dictColumnRules，纯函数可
 * 单测直测）。
 */
export function buildDictFormColumns(): ColumnsSpec {
  return {
    pk: ({ column }) => ({ ...column, hideInForm: true }),
    is_locked: ({ column }) => ({ ...column, hideInForm: true }),
    code: ({ column, rawRow }) => dictCodeColumnTransform({ column, rawRow }),
    parent: ({ column, rawRow, isAdd }) =>
      dictParentColumnTransform({ column, rawRow, isAdd }),
    // 字典值仅字典项使用；类型行隐藏
    value: ({ column, rawRow }) => dictValueColumnTransform({ column, rawRow })
  };
}
