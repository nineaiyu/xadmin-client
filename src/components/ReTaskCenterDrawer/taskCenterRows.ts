import type { ListResult } from "@/api/types";

/** 任务中心行：只取抽屉展示需要的四个键（缺失按空串/空值兜底） */
export type TaskCenterRow = {
  pk: string;
  name: string;
  /** 状态原始值：字典驱动字段下发 `{value,label,color}` 对象，普通 Choice 下发标量 */
  status: unknown;
  created_time: string;
};

/** 列表响应 → 抽屉行（审批单用 title，导出/导入/任务执行用 name） */
export function toTaskCenterRows(res: {
  code: number;
  data?: unknown;
}): TaskCenterRow[] {
  const results = ((res.data as ListResult["data"] | undefined)?.results ??
    []) as Record<string, unknown>[];
  return results.map(item => ({
    pk: String(item.pk ?? ""),
    name: String(item.name ?? item.title ?? ""),
    status: item.status,
    created_time: String(item.created_time ?? "")
  }));
}

/** 状态取值：字典对象取 value，避免 `[object Object]` 与状态判断失配 */
export function taskCenterStatusValue(row: TaskCenterRow): string {
  const status = row.status;
  if (typeof status === "object" && status !== null) {
    return String((status as { value?: unknown }).value ?? "");
  }
  return String(status ?? "");
}

/** 状态显示文案：优先字典 label，避免把内部取值（如 PENDING）直接给用户看 */
export function taskCenterStatusLabel(row: TaskCenterRow): string {
  const status = row.status;
  if (typeof status === "object" && status !== null) {
    const item = status as { label?: unknown; value?: unknown };
    return String(item.label ?? item.value ?? "");
  }
  return String(status ?? "");
}
