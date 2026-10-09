/** 执行历史行（列表列渲染 / 按钮判定使用的字段） */
export type ExecutionRow = {
  pk?: string | number;
  id?: string | number;
  name?: string;
  product_type?: string;
  product_name?: string;
  product_progress?: number;
  product_stage?: string;
  product_has_file?: boolean;
  can_cancel?: boolean;
  can_rerun?: boolean;
  status?: { value?: string; label?: string } | string;
  time_cost?: number | null;
};

/** 产物类型标签语义色（非产物任务为「任务」默认色） */
export const PRODUCT_TAG_TYPE: Record<
  string,
  "primary" | "success" | "warning"
> = {
  export: "success",
  import: "warning"
};

/** 取消/重跑权限点：挂执行历史菜单下，不能靠组件名推导 */
export const PERM_CANCEL = "cancel:SystemTaskExecution";
export const PERM_RERUN = "rerun:SystemTaskExecution";

export const asExecutionRow = (row: unknown) => row as ExecutionRow;

/** 状态取值：字典字段可能是 {value,label} 对象，也可能已是标量 */
export const statusValue = (row: ExecutionRow) => {
  const status = row.status;
  return typeof status === "object" && status ? status.value : status;
};
