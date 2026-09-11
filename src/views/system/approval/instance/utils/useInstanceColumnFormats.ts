import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import type { PageTableColumn } from "@/components/RePlusPage";
import { statusTagProps, type StatusTagType } from "@/utils/dict";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 字典色失效时的 EP tag 语义色兜底（approval_status 同集：PENDING/APPROVED/REJECTED/CANCELLED） */
const FLOW_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info",
  PENDING: "warning"
};

/** 实例列表列渲染：状态列（字典驱动）与当前节点占位符（拆分自 hook.tsx，行为不变） */
export function useInstanceColumnFormats({ t }: { t: TFunction }) {
  /** 状态列：字典驱动（approval_status）颜色/文案，字典未配置回退页面 i18n */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          column.cellRenderer = data => {
            const row = data.row;
            const status = row.status?.value ?? row.status;
            return h(
              ElTag,
              statusTagProps(row.status, FLOW_STATUS_TAG_TYPE),
              () =>
                row.status?.label ?? t(`systemApprovalInstance.status${status}`)
            );
          };
          break;
        case "current_node_name":
          // 已结束实例 current_node 为空：统一显示占位符，避免列空白
          column.cellRenderer = data => data.row.current_node_name || "-";
          break;
      }
    });
    return columns;
  };

  return { listColumnsFormat };
}
