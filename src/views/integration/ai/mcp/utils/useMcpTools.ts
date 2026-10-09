import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { addDrawer } from "@/components/ReDrawer";
import { SUCCESS_CODE } from "@/api/types";
import { mcpServerApi, type McpServerItem } from "@/api/ai/mcp";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import McpToolsDrawer from "../components/McpToolsDrawer.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** MCP 服务器行操作（自 mcp/utils/hook 抽出）：同步工具快照 / 工具抽屉 */
export function useMcpTools({
  t,
  refresh
}: {
  t: TFunction;
  refresh: () => void;
}) {
  /** 行内同步：loading 由按钮组件按行持有（每行独立实例），同步期间禁点防并发触发 */
  const runSync = async (row: McpServerItem, loading?: { value: boolean }) => {
    if (loading?.value) return;
    if (loading) loading.value = true;
    try {
      const res = await mcpServerApi.sync(row.pk).catch(normalizeError);
      if (res.code === SUCCESS_CODE) {
        const count = (res.data as { count?: number } | null)?.count ?? 0;
        message(t("mcp.syncDone", { count }), { type: "success" });
      } else {
        message(String(res.detail ?? t("results.failed")), { type: "warning" });
      }
    } finally {
      if (loading) loading.value = false;
    }
    refresh();
  };

  const openTools = (row: McpServerItem) => {
    addDrawer({
      title: t("mcp.drawerTitle", { name: row.name }),
      size: "55%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(McpToolsDrawer, { row, onSynced: () => refresh() })
    });
  };

  return { runSync, openTools };
}
