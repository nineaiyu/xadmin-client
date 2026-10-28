import { cloneDeep, unset } from "lodash-es";
import { isRef } from "vue";
import type { RecordType } from "plus-pro-components";

/**
 * 提交前剔除「表单内被隐藏的列」（FE-UI-P2-39）。
 *
 * 背景：`hideInForm` 只控制渲染与布局，表单模型里仍保留该字段的旧值；
 * 后端 PATCH 语义是「未提交键保留」，因此用户把某字段联动隐藏后旧值仍会被写回，
 * 表现为「字段消失了但值没清」。提交前删键即可让 PATCH 保持原值、创建走后端默认。
 *
 * 只处理**联动**形态（`computed`）：静态 `hideInForm: true` 属于布局性隐藏（如角色表单的
 * `fields` 列，其提交值由页面 `beforeSubmit` 从授权树重建），不能一刀切删除。
 */
export function stripHiddenFormFields<T extends RecordType>(
  formData: T,
  columns?: unknown
): T {
  if (!formData || typeof formData !== "object") return formData;
  const list = Array.isArray(columns)
    ? columns
    : columns && typeof columns === "object"
      ? Object.values(columns)
      : [];
  if (!list.length) return formData;

  let next: T | null = null;
  for (const column of list as Array<Record<string, unknown>>) {
    const hideInForm = column?.hideInForm;
    if (!isRef(hideInForm) || hideInForm.value !== true) continue;
    const prop = column?.prop;
    if (typeof prop !== "string" || !prop) continue;
    next ??= cloneDeep(formData);
    unset(next, prop);
  }
  return next ?? formData;
}
