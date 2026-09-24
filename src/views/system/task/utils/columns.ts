import type { TaskCenterKind, TaskCenterRow } from "@/api/system/task";

/** 任务中心列/筛选的取值映射与展示口径（纯函数，便于单测） */

export const TYPE_TAG_TYPE: Record<
  TaskCenterKind,
  "primary" | "success" | "warning"
> = {
  task: "primary",
  export: "success",
  import: "warning"
};

export const STATUS_TAG_TYPE: Record<
  string,
  "info" | "warning" | "success" | "danger"
> = {
  PENDING: "info",
  RUNNING: "warning",
  SUCCESS: "success",
  FAILURE: "danger",
  REVOKED: "info"
};

/** 筛选项与表格类型列的取值来源（文案走 i18n） */
export const TYPE_OPTIONS: { value: TaskCenterKind; labelKey: string }[] = [
  { value: "task", labelKey: "taskCenter.typeTask" },
  { value: "export", labelKey: "taskCenter.typeExport" },
  { value: "import", labelKey: "taskCenter.typeImport" }
];

export const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "PENDING", labelKey: "taskCenter.statusPending" },
  { value: "RUNNING", labelKey: "taskCenter.statusRunning" },
  { value: "SUCCESS", labelKey: "taskCenter.statusSuccess" },
  { value: "FAILURE", labelKey: "taskCenter.statusFailure" },
  { value: "REVOKED", labelKey: "taskCenter.statusRevoked" }
];

/** 运行中（可取消）的状态集合，与后端 ACTIVE_STATUSES 同口径 */
export const ACTIVE_STATUSES = ["PENDING", "RUNNING"];

/** el-table 插槽行类型为 DefaultRow：统一归一为任务中心行类型（避免模板内散落断言） */
export function asRow(row: unknown): TaskCenterRow {
  return row as TaskCenterRow;
}

/** 来源列：执行历史显示所属定时任务，导出/导入显示来源模块 */
export function sourceOf(row: TaskCenterRow): string {
  return row.periodic_task || row.module || "";
}

/** 耗时展示：仅执行历史有值（秒，保留一位小数） */
export function timeCostText(row: TaskCenterRow): string {
  const cost = row.time_cost;
  if (cost === null || cost === undefined) return "-";
  return `${Number(cost).toFixed(1)}s`;
}

export function progressOf(row: TaskCenterRow): number | null {
  return row.progress === null || row.progress === undefined
    ? null
    : row.progress;
}

export function progressStatus(row: TaskCenterRow) {
  if (row.status === "FAILURE" || row.status === "REVOKED") return "exception";
  if (row.status === "SUCCESS") return "success";
  return undefined;
}

/** 可清理的执行历史主键（导出/导入记录的删除在下载中心） */
export function deletablePks(rows: TaskCenterRow[]): string[] {
  return rows.filter(row => row.can_delete).map(row => row.pk);
}
