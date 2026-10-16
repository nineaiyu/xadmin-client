import type { StatusTagType } from "@/utils/dict";

/** 请假状态语义色兜底（字典 leave_status 未配 color 时使用） */
export const LEAVE_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};

/** labeled_choice 可能是 {value,label,color} 或裸字符串 */
export const statusOf = (row: Record<string, unknown>) => {
  const status = row?.status;
  return status && typeof status === "object"
    ? String((status as { value?: string }).value ?? "")
    : String(status ?? "");
};

/** 可重新提交的状态（草稿 / 已驳回 / 已撤回） */
export const RESUBMITTABLE = ["DRAFT", "REJECTED", "CANCELLED"];
