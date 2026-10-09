import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { statusTagProps } from "@/utils/dict";
import { SOLID_TAG_STYLE } from "@/utils/tagTone";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import { LEAVE_STATUS_TAG_TYPE, statusOf } from "./leaveRules";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 请假列表列渲染（自 hook.tsx 抽出，行数门禁）：类型彩标（字典驱动）/ 状态
 * （字典色 + 页面 i18n 回退）/ 当前节点（驳回时给出可读提示）。
 */
export function useLeaveColumns({ t }: { t: TFunction }) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      leave_type: column => {
        column.cellRenderer = ({ row }) => {
          const raw = row.leave_type;
          if (raw === null || raw === undefined || raw === "") return "—";
          if (typeof raw === "string") return raw;
          const item = raw as { label?: string; color?: string };
          return h(
            ElTag,
            item.color ? { color: item.color, style: SOLID_TAG_STYLE } : {},
            () => item.label ?? "—"
          );
        };
      },
      status: column => {
        column.cellRenderer = ({ row }) =>
          h(
            ElTag,
            statusTagProps(row.status, LEAVE_STATUS_TAG_TYPE),
            () =>
              (row.status as { label?: string })?.label ??
              t(`leaveApply.status${statusOf(row)}`)
          );
      },
      current_node_name: column => {
        column.cellRenderer = ({ row }) =>
          row.current_node_name ||
          (statusOf(row) === "REJECTED" ? t("leaveApply.rejectedTip") : "—");
      }
    });

  return { listColumnsFormat };
}
