import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { mcpServerApi } from "@/api/ai/mcp";
import { useMcpServerFormOptions } from "./useMcpServerFormOptions";
import { useMcpTools } from "./useMcpTools";
import { useMcpColumns } from "./useMcpColumns";
import { useMcpButtons } from "./useMcpButtons";

/**
 * 外部 MCP 服务器页装配：
 * - 列表与增删改走 RePlusPage 标准元数据表单（页面在
 *   `useMcpServerFormOptions` 里把令牌换密码框、白名单换逗号文本）；
 * - 行操作「工具」打开抽屉：资料卡 + 工具快照清单 + 调用测试（白名单内）；
 * - 「同步」拉取 tools/list 更新服务器快照。
 */
export function useMcpServers(tableRef: Ref) {
  const { t } = useI18n();
  const auth = usePageAuth("AiMcpServers");
  const canSync = hasAuth("sync:AiMcpServers");
  const api = reactive(mcpServerApi);

  const refresh = () => tableRef.value?.handleGetData();

  const { addOrEditOptions } = useMcpServerFormOptions({ t });
  const { runSync, openTools } = useMcpTools({ t, refresh });
  const { listColumnsFormat } = useMcpColumns({ t, openTools });
  const { operationButtonsProps } = useMcpButtons({
    t,
    canSync,
    runSync,
    openTools
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
