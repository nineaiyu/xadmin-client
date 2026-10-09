import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { approvalApi } from "@/api/approval/approval";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { openApprovalProgressDialog, type TargetSnapshot } from "./dialogs";

/**
 * 审批进度弹窗入口（自 hook.tsx 抽出，行数门禁）：先取详情里的 steps + 目标快照
 * 再打开；详情拉取失败（网络异常或业务码非成功）显式提示，不再静默无响应。
 */
export function useApprovalProgress() {
  const { t } = useI18n();

  const openProgress = (row?: RecordType) => {
    if (!row?.pk) return;
    approvalApi
      .retrieve?.(row.pk)
      ?.then(res => {
        if (res.code !== SUCCESS_CODE || !res.data) {
          message(t("approval.progressLoadFailed"), { type: "warning" });
          return;
        }
        const detail = res.data as RecordType;
        openApprovalProgressDialog({
          t,
          no: String(row.pk).slice(0, 8).toUpperCase(),
          steps: (detail.steps ?? []) as Array<RecordType>,
          // 目标对象变更对照（敏感操作审批的目标快照；缺失时弹窗跳过该区块）
          snapshot: (detail.target_snapshot ?? null) as TargetSnapshot | null
        });
      })
      .catch(() => {
        message(t("approval.progressLoadFailed"), { type: "warning" });
      });
  };

  return { openProgress };
}
