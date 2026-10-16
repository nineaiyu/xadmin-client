import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import type { RecordType } from "plus-pro-components";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import { statusTagProps } from "@/utils/dict";
import { APPROVAL_STATUS_TAG_TYPE } from "./constants";
import { approverText } from "./approvalTexts";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 审批中心列表列渲染（自 hook.tsx 抽出，行数门禁）：状态列（字典驱动
 * approval_status，字典未配置回退页面 i18n）与审批人列（文案规则见
 * approvalTexts.ts，点击查看审批详情）。
 */
export function useApprovalColumns({
  t,
  openProgress
}: {
  t: TFunction;
  openProgress: (row?: RecordType) => void;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      status: column => {
        column.cellRenderer = data => {
          const row = data.row;
          const status = row.status?.value ?? row.status;
          return h(
            ElTag,
            statusTagProps(row.status, APPROVAL_STATUS_TAG_TYPE),
            () => row.status?.label ?? t(`approval.status${status}`)
          );
        };
      },
      // 审批人列：多级链显示「第 N 级：当前级候选人」，扁平单显示实际审批人或
      // 「待审批」占位；两者均可点击查看审批详情（详情含目标对象变更对照）
      approver: column => {
        column.cellRenderer = ({ row }) =>
          h(
            ElLink,
            {
              type: "primary",
              onClick: () => openProgress(row)
            },
            () => approverText(row, t)
          );
      }
    });

  return { listColumnsFormat };
}
