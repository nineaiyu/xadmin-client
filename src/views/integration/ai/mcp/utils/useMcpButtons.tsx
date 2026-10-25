import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { McpServerItem } from "@/api/ai/mcp";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * MCP 服务器行操作按钮装配：只保留页面专属的「同步 / 工具」。
 *
 * 新增 / 编辑由框架元数据表单提供（`auth.create/partialUpdate` 未关闭）；
 * 资料与工具清单由抽屉承载，默认「查看」入口关闭。
 */
export function useMcpButtons({
  t,
  canSync,
  runSync,
  openTools,
  openLogs,
  canLogs
}: {
  t: TFunction;
  canSync: boolean;
  runSync: (row: McpServerItem, loading?: { value: boolean }) => Promise<void>;
  openTools: (row: McpServerItem) => void;
  openLogs: (row: McpServerItem) => void;
  canLogs: boolean;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 默认按钮（编辑 / 删除）+ 同步 / 工具 全内联
    width: 260,
    hideDetail: true,
    showNumber: 6,
    buttons: [
      {
        text: t("mcp.sync"),
        code: "sync",
        props: { type: "primary", link: true },
        onClick: ({ row, loading }) => runSync(row as McpServerItem, loading),
        show: canSync
      },
      {
        text: t("mcp.tools"),
        code: "tools",
        props: { link: true },
        onClick: ({ row }) => openTools(row as McpServerItem),
        index: 10,
        show: true
      },
      {
        text: t("mcp.logs"),
        code: "logs",
        props: { link: true },
        onClick: ({ row }) => openLogs(row as McpServerItem),
        index: 11,
        show: canLogs
      }
    ]
  });

  return { operationButtonsProps };
}
