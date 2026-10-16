import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { McpServerItem } from "@/api/ai/mcp";

type TFunction = ReturnType<typeof useI18n>["t"];

/** MCP 服务器列渲染（自 mcp/utils/hook 抽出）：入口链接 + 只读状态/失败原因 */
export function useMcpColumns({
  t,
  openTools
}: {
  t: TFunction;
  openTools: (row: McpServerItem) => void;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      name: column => {
        column["cellRenderer"] = ({ row }) => {
          const item = row as McpServerItem;
          return h(
            ElLink,
            { type: "primary", onClick: () => openTools(item) },
            () => item.name
          );
        };
      },
      enabled: column => {
        // 只读状态标签：编辑入口收敛到表单弹窗（避免禁用态开关的重复入口）
        column["cellRenderer"] = ({ row, props }) => {
          const enabled = Boolean((row as McpServerItem).enabled);
          return h(
            ElTag,
            {
              type: enabled ? "success" : "danger",
              size: props.size,
              effect: "plain"
            },
            () => (enabled ? t("mcp.enabled") : t("mcp.disabled"))
          );
        };
      },
      last_sync_error: column => {
        column["cellRenderer"] = ({ row }) => {
          const detail = String((row as McpServerItem).last_sync_error || "");
          return detail
            ? h("span", { class: "text-(--el-color-danger) text-xs" }, detail)
            : h("span", {}, "-");
        };
      }
    });

  return { listColumnsFormat };
}
