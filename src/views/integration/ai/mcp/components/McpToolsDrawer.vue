<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import {
  mcpServerApi,
  type McpServerItem,
  type McpToolSnapshot
} from "@/api/ai/mcp";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { hasAuth } from "@/router/utils";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import McpCallPanel from "./McpCallPanel.vue";

/**
 * 外部 MCP 服务器抽屉：资料卡 + 工具快照清单 + 调用测试（白名单内）。
 *
 * - 「同步」拉取最新 tools/list（更新服务器快照，列表刷新由页面侧负责）；
 * - 「调用」仅白名单工具可用（服务端 fail-closed，未列出的工具被拒并落审计）；
 * - 调用表单与结果展示在 McpCallPanel（按 input_schema 派生控件）。
 *
 * 同步与调用各挂独立权限点（sync / call:AiMcpServers）：无授权时不渲染对应
 * 入口，避免点击后服务端 403。
 */
defineOptions({ name: "McpToolsDrawer" });

const props = defineProps<{
  row: McpServerItem;
  /** 同步成功后回调（页面侧刷新列表行快照） */
  onSynced?: () => void;
}>();

const { t } = useI18n();

const tools = ref<McpToolSnapshot[]>([...(props.row.tools_snapshot ?? [])]);
/** 抽屉资料以详情为准（列表行是快照，同步后 last_synced_time/error 会过期） */
const server = ref<McpServerItem>({ ...props.row });
const syncing = ref(false);
const callTool = ref("");

const loadDetail = async () => {
  if (!hasAuth("retrieve:AiMcpServers")) return;
  if (typeof mcpServerApi.retrieve !== "function") return;
  const res = await mcpServerApi.retrieve(props.row.pk).catch(normalizeError);
  if (isSuccess(res) && res.data) {
    const detail = res.data as McpServerItem;
    server.value = detail;
    tools.value = [...(detail.tools_snapshot ?? [])];
  }
};

onMounted(loadDetail);

/** 工具快照只读列（调用列按权限出现） */
const columns = computed<ReadonlyColumn[]>(() => {
  const cols: ReadonlyColumn[] = [
    { prop: "name", label: t("mcp.toolName"), minWidth: 140 },
    {
      prop: "description",
      label: t("mcp.toolDescription"),
      minWidth: 200,
      showOverflowTooltip: true
    },
    { label: t("mcp.toolReadOnly"), width: 90, slot: "readOnly" },
    { label: t("mcp.toolParams"), minWidth: 140, slot: "params" },
    { label: t("mcp.toolActionSurface"), width: 100, slot: "actionSurface" }
  ];
  if (hasAuth("call:AiMcpServers")) {
    cols.push({
      label: t("mcp.toolCall"),
      width: 90,
      fixed: "right",
      slot: "call"
    });
  }
  return cols;
});

const runSync = async () => {
  syncing.value = true;
  try {
    const res = await mcpServerApi.sync(props.row.pk).catch(normalizeError);
    if (isSuccess(res)) {
      tools.value =
        (res.data as { tools?: McpToolSnapshot[] } | null)?.tools ?? [];
      message(t("mcp.syncDone", { count: tools.value.length }), {
        type: "success"
      });
      // 同步更新 last_synced_time / last_sync_error，避免抽屉停留在旧快照
      await loadDetail();
      props.onSynced?.();
    } else {
      message(String(res.detail ?? t("results.failed")), { type: "warning" });
    }
  } finally {
    syncing.value = false;
  }
};

const pickTool = (raw: unknown) => {
  const tool = raw as McpToolSnapshot;
  callTool.value = tool.name;
};

/** 工具是否已接入 AI 动作面：后端快照条目带 callable 标记（列表时按调用准入
 * 规则计算）时直接消费；字段缺失（在途旧后端）回落前端镜像规则兜底 */
const inActionSurface = (raw: unknown) => {
  const tool = raw as McpToolSnapshot;
  if (typeof tool.callable === "boolean") return tool.callable;
  return Boolean(
    server.value.enabled &&
    server.value.expose_to_ai &&
    (server.value.allowed_tools ?? []).includes(tool.name) &&
    tool.input_schema &&
    Object.keys(tool.input_schema).length > 0
  );
};
</script>

<template>
  <div>
    <el-descriptions :column="2" border size="small" class="mb-3">
      <el-descriptions-item :label="t('mcp.panelUrl')">
        {{ server.url }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelAuth')">
        <el-tag :type="server.auth_token_set ? 'success' : 'info'" size="small">
          {{
            server.auth_token_set
              ? t("mcp.panelAuthSet")
              : t("mcp.panelAuthUnset")
          }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelTimeout')">
        {{ server.timeout }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelAllowed')">
        {{
          server.allowed_tools?.length
            ? server.allowed_tools.join("、")
            : t("mcp.panelAllowedEmpty")
        }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelLastSync')">
        {{ server.last_synced_time || "-" }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelSyncError')">
        <span :class="server.last_sync_error ? 'text-(--el-color-danger)' : ''">
          {{ server.last_sync_error || "-" }}
        </span>
      </el-descriptions-item>
    </el-descriptions>

    <div class="mb-2 flex-bc">
      <span class="font-medium">{{ t("mcp.tools") }}</span>
      <el-button
        v-if="hasAuth('sync:AiMcpServers')"
        size="small"
        :loading="syncing"
        data-testid="mcp-drawer-sync"
        @click="runSync"
      >
        {{ t("mcp.sync") }}
      </el-button>
    </div>
    <ReReadonlyTable
      :columns="columns"
      :rows="tools"
      size="small"
      data-testid="mcp-tools-table"
      :empty-text="t('mcp.empty')"
    >
      <template #readOnly="{ row: tool }">
        <el-tag
          :type="tool.read_only ? 'success' : 'warning'"
          size="small"
          effect="plain"
        >
          {{ tool.read_only ? t("mcp.readOnlyYes") : t("mcp.readOnlyNo") }}
        </el-tag>
      </template>
      <template #params="{ row: tool }">
        {{ (tool.params ?? []).join("、") || "-" }}
      </template>
      <template #actionSurface="{ row: tool }">
        <el-tag
          :type="inActionSurface(tool) ? 'success' : 'info'"
          size="small"
          effect="plain"
        >
          {{
            inActionSurface(tool)
              ? t("mcp.actionSurfaceIn")
              : t("mcp.actionSurfaceOut")
          }}
        </el-tag>
      </template>
      <template #call="{ row: tool }">
        <el-button
          link
          type="primary"
          size="small"
          :disabled="!inActionSurface(tool)"
          :title="inActionSurface(tool) ? '' : t('mcp.toolCallUnavailable')"
          @click="pickTool(tool)"
        >
          {{ t("mcp.toolCall") }}
        </el-button>
      </template>
    </ReReadonlyTable>

    <McpCallPanel
      v-if="hasAuth('call:AiMcpServers')"
      class="mt-4"
      :server="server"
      :tools="tools"
      :tool-name="callTool"
    />
  </div>
</template>
