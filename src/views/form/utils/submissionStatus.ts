import type { StatusTagType } from "@/utils/dict";

/**
 * 提交状态（审批回写）语义色兜底：字典未配 color 时按审批结果取 EP 语义色。
 *
 * 我的填报 / 表单数据 / 提交详情三处共用（此前三份逐字重复）；tag props 统一经
 * `statusTagProps`，禁止页面自建映射函数。
 */
export const SUBMISSION_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};
