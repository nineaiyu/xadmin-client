import type { RecordType } from "plus-pro-components";
import { isChainRow } from "./approvalRowRules";

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

/** 批量操作部分失败明细：`单号: 原因` 列表以「；」连接（与文案插值口径一致） */
export const batchFailedDetail = (
  failed: Array<{ no: string; reason: string }>
) => failed.map(item => `${item.no}: ${item.reason}`).join("；");
