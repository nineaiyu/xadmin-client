import { h } from "vue";
import { ElTag } from "element-plus";
import type { useI18n } from "vue-i18n";
import type { PageTableColumn } from "@/components/RePlusPage";

type TFunction = ReturnType<typeof useI18n>["t"];

const statusOf = (row: Record<string, unknown>) => {
  if (!row.is_active) return { key: "disabled", type: "info" as const };
  const now = Date.now();
  const start = Date.parse(String(row.start_time ?? ""));
  const end = Date.parse(String(row.end_time ?? ""));
  if (Number.isFinite(start) && start > now) {
    return { key: "notStarted", type: "warning" as const };
  }
  if (Number.isFinite(end) && end < now) {
    return { key: "expired", type: "danger" as const };
  }
  return { key: "active", type: "success" as const };
};

/** 委托生效状态派生列（is_active + 起止时间），放在起止时间之后便于比对 */
export function buildDelegationStatusColumn(t: TFunction): PageTableColumn {
  return {
    label: t("systemApprovalDelegation.effectiveStatus"),
    prop: "delegation_status",
    _column: { key: "delegation_status" },
    width: 110,
    cellRenderer: ({ row }: { row: Record<string, unknown> }) => {
      const status = statusOf(row);
      return h(ElTag, { size: "small", type: status.type }, () =>
        t(`systemApprovalDelegation.status_${status.key}`)
      );
    }
  } as PageTableColumn;
}
