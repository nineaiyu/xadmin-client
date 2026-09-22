import type { StatusTagType } from "@/utils/dict";

/**
 * 字典色失效时的 EP tag 语义色兜底（审批状态）。
 * 供列表状态列（utils/hook.tsx）与进度弹窗（utils/dialogs.tsx）共用。
 */
export const APPROVAL_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  FAILED: "danger",
  PENDING: "warning"
};
