import { shallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { McpServerItem } from "@/api/ai/mcp";
import Plus from "~icons/ep/plus";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * MCP 服务器按钮装配（自 mcp/utils/hook 抽出）：工具栏「新增」与行操作
 * 「同步 / 工具 / 编辑」（资料与工具清单由抽屉承载，默认「查看」入口关闭）。
 */
export function useMcpButtons({
  t,
  flags: { canCreate, canSync, canUpdate },
  openForm,
  runSync,
  openTools
}: {
  t: TFunction;
  flags: {
    canCreate: boolean;
    canSync: boolean;
    canUpdate: boolean;
  };
  openForm: (row?: McpServerItem) => void;
  runSync: (row: McpServerItem, loading?: { value: boolean }) => Promise<void>;
  openTools: (row: McpServerItem) => void;
}) {
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("mcp.create"),
        code: "create",
        props: {
          type: "primary",
          icon: useRenderIcon(Plus)
        },
        onClick: () => openForm(),
        show: canCreate
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    // 资料与工具清单由抽屉承载（默认「查看」入口关闭）；4 个行操作全内联
    width: 260,
    hideDetail: true,
    showNumber: 4,
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
        text: t("buttons.edit"),
        code: "edit",
        props: { link: true },
        onClick: ({ row }) => openForm(row as McpServerItem),
        show: canUpdate
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
