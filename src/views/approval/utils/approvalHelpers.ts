import type { RecordType } from "plus-pro-components";
import type { StatusTagType } from "@/utils/dict";

/**
 * 审批中心纯函数与展示常量（P2-128 合并）：状态色兜底、审批人文案、
 * 行级可见性规则。原先分散在 constants/approvalTexts/approvalRowRules 三个文件。
 */

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

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * 审批列表文案（纯函数，自 useApprovalPanel 抽出便于单测直测）。
 */

/** 「审批人」列文案：多级链显示当前级候选人；扁平单显示实际审批人（未处理时占位说明） */
export const approverText = (row: RecordType | undefined, t: Translate) => {
  if (isChainRow(row)) {
    const names = ((row?.current_assignees ?? []) as Array<RecordType>)
      .map(item => item?.username ?? item?.pk)
      .filter(Boolean);
    return `${t("approval.levelNo", { n: row?.current_level })}：${
      names.join("、") || t("approval.pendingApprover")
    }`;
  }
  return row?.approver?.username || t("approval.pendingApprover");
};

/** 批量操作部分失败明细：`单号前 8 位: 原因` 列表以「；」连接（与文案插值口径一致） */
export const batchFailedDetail = (
  failures: Array<{ pk: string; detail: string }>
) => failures.map(item => `${item.pk.slice(0, 8)}: ${item.detail}`).join("；");

/**
 * 审批行级可见性规则（纯函数，自 useApprovalPanel 抽出便于单测直测）：
 * 多级审批链单只有当前级候选人可审（服务端 can_act 收口），扁平单沿用页面权限。
 */

/** 多级审批链单：带当前级即「配置到某个人/角色」的逐级审批单（current_level>0） */
export const isChainRow = (row?: RecordType) =>
  Number(row?.current_level ?? 0) > 0;

/** 行级动作可见性：多级链按服务端 can_act 收口，扁平单恒可见 */
export const canActRow = (row?: RecordType) =>
  isChainRow(row) ? Boolean(row?.can_act) : true;
