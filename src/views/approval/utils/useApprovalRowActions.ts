import { h, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { addDialog } from "@/components/ReDialog";
import { hasAuth } from "@/router/utils";
import { approvalApi } from "@/api/approval/approval";
import type {
  OperationButtonsRow,
  OperationProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ApprovalLogsDialog from "../components/ApprovalLogsDialog.vue";
import { openRejectReasonDialog } from "./dialogs";
import { approvalRowButtons } from "./approvalRowButtons";
import Document from "~icons/ep/document";

/**
 * 审批面板行内操作：通过/驳回（待我审批）与撤回（我发起的），及互跳操作日志。
 * 自 useApprovalPanel 拆出（行为不变）：多级链按服务端 can_act 收口
 * （见 approvalRowRules.ts），按钮数组见 approvalRowButtons.ts。
 */
export function useApprovalRowActions({
  scope,
  auth,
  refresh
}: {
  scope: "pending" | "mine";
  auth: Record<string, boolean | undefined>;
  refresh: () => void;
}) {
  const { t } = useI18n();

  /** 互跳抽屉要读操作日志：无该菜单权限时按钮不展示（否则必然 403） */
  const canReadOperationLog = hasAuth("list:SystemOperationLog");

  /** 驳回弹窗（弹窗工厂见 utils/dialogs.tsx）：原因必填 + 成功后刷新列表/角标/统计 */
  const openReject = (row: RecordType) => {
    openRejectReasonDialog({
      t,
      title: t("approval.rejectTitle", {
        no: String(row.pk).slice(0, 8).toUpperCase()
      }),
      submit: reason => approvalApi.reject(row.pk, reason),
      onSuccess: () => refresh()
    });
  };

  /** 互跳：查看该审批单对应的操作日志（近似口径，弹窗内已标注） */
  const openRelatedLogs = (row: RecordType) => {
    addDialog({
      title: `${t("approval.relatedLogs")} - ${String(row.pk).slice(0, 8).toUpperCase()}`,
      width: "860px",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      props: {
        path: row.path,
        objectPk: row.object_pk,
        creatorPk: row.creator?.pk
      },
      contentRenderer: () => h(ApprovalLogsDialog)
    });
  };

  /** 互跳按钮：两个页签共用（无操作日志读权限时不展示） */
  const relatedLogsButton: OperationButtonsRow = {
    text: t("approval.relatedLogs"),
    code: "relatedLogs",
    props: {
      type: "info",
      icon: useRenderIcon(Document),
      link: true
    },
    tooltip: { content: t("approval.relatedLogs") },
    onClick: ({ row }) => openRelatedLogs(row),
    index: 6,
    show: canReadOperationLog
  };

  /** 行内按钮：待我审批页签 = 通过/驳回；我发起的页签 = 撤回（仅 PENDING） */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 300,
    buttons: approvalRowButtons(scope, {
      t,
      auth,
      refresh,
      openReject,
      relatedLogsButton
    })
  });

  return {
    operationButtonsProps
  };
}
