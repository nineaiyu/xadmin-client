import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { mcpServerApi } from "@/api/ai/mcp";
import { useMcpServerForm } from "./useMcpServerForm";
import { useMcpTools } from "./useMcpTools";
import { useMcpColumns } from "./useMcpColumns";
import { useMcpButtons } from "./useMcpButtons";

/**
 * 外部 MCP 服务器页装配：
 * - 列表走 RePlusPage 标准 CRUD（删除保留框架默认入口，编辑走自定义表单弹窗）；
 * - 行操作「工具」打开抽屉：资料卡 + 工具快照清单 + 调用测试（白名单内）；
 * - 「同步」拉取 tools/list 更新服务器快照。
 *
 * 职责拆分：
 * - useMcpServerForm   新建/编辑弹窗（ReDialog + McpServerForm）；
 * - useMcpTools        行内同步与工具抽屉；
 * - useMcpColumns      列渲染（入口链接 + 只读状态/失败原因）；
 * - useMcpButtons      工具栏与行操作按钮装配。
 */
export function useMcpServers(tableRef: Ref) {
  const { t } = useI18n();
  const auth = usePageAuth("AiMcpServers");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:AiMcpServers");
  const canUpdate = hasAuth("partialUpdate:AiMcpServers");
  const canSync = hasAuth("sync:AiMcpServers");
  const api = reactive(mcpServerApi);

  const refresh = () => tableRef.value?.handleGetData();

  const { openForm } = useMcpServerForm({ t, refresh });
  const { runSync, openTools } = useMcpTools({ t, refresh });
  const { listColumnsFormat } = useMcpColumns({ t, openTools });
  const { tableBarButtonsProps, operationButtonsProps } = useMcpButtons({
    t,
    flags: { canCreate, canSync, canUpdate },
    openForm,
    runSync,
    openTools
  });

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
