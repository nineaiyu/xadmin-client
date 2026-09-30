<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import {
  mcpServerApi,
  type McpCallResult,
  type McpServerItem,
  type McpToolSnapshot
} from "@/api/ai/mcp";
import { message } from "@/utils/message";

/**
 * 外部 MCP 服务器抽屉：资料卡 + 工具快照清单 + 调用测试（白名单内）。
 *
 * - 「同步」拉取最新 tools/list（更新服务器快照，列表刷新由页面侧负责）；
 * - 「调用」仅白名单工具可用（服务端 fail-closed，未列出的工具被拒并落审计）；
 * - 参数按 JSON 对象填写，结果文本截断展示。
 */
defineOptions({ name: "McpToolsDrawer" });

const props = defineProps<{
  row: McpServerItem;
  /** 同步成功后回调（页面侧刷新列表行快照） */
  onSynced?: () => void;
}>();

const { t } = useI18n();

const tools = ref<McpToolSnapshot[]>([...(props.row.tools_snapshot ?? [])]);
const syncing = ref(false);
const calling = ref(false);
const callTool = ref("");
const callArguments = ref("{}");
const callResult = ref<McpCallResult | null>(null);

/** 请求异常归一（与弹窗同口径）：失败也给可读 detail，避免 loading 悬挂 */
const normalizeError = (error: unknown) => ({
  code: -1,
  data: null,
  detail: String((error as { detail?: string })?.detail ?? error)
});

const runSync = async () => {
  syncing.value = true;
  try {
    const res = await mcpServerApi.sync(props.row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      tools.value =
        (res.data as { tools?: McpToolSnapshot[] } | null)?.tools ?? [];
      message(t("mcp.syncDone", { count: tools.value.length }), {
        type: "success"
      });
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
  callArguments.value = "{}";
  callResult.value = null;
};

const runCall = async () => {
  let args: Record<string, unknown>;
  try {
    const parsed = JSON.parse(callArguments.value || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("not an object");
    args = parsed as Record<string, unknown>;
  } catch {
    message(t("mcp.callInvalidJson"), { type: "warning" });
    return;
  }
  calling.value = true;
  try {
    const res = await mcpServerApi
      .call(props.row.pk, callTool.value, args)
      .catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      callResult.value = res.data as McpCallResult;
    } else {
      callResult.value = {
        tool: callTool.value,
        is_error: true,
        text: String(res.detail ?? "")
      };
    }
  } finally {
    calling.value = false;
  }
};
</script>

<template>
  <div>
    <el-descriptions :column="2" border size="small" class="mb-3">
      <el-descriptions-item :label="t('mcp.panelUrl')">
        {{ row.url }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelAuth')">
        <el-tag :type="row.auth_token_set ? 'success' : 'info'" size="small">
          {{
            row.auth_token_set ? t("mcp.panelAuthSet") : t("mcp.panelAuthUnset")
          }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelTimeout')">
        {{ row.timeout }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelAllowed')">
        {{
          row.allowed_tools?.length
            ? row.allowed_tools.join("、")
            : t("mcp.panelAllowedEmpty")
        }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelLastSync')">
        {{ row.last_synced_time || "-" }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('mcp.panelSyncError')">
        <span :class="row.last_sync_error ? 'text-(--el-color-danger)' : ''">
          {{ row.last_sync_error || "-" }}
        </span>
      </el-descriptions-item>
    </el-descriptions>

    <div class="mb-2 flex-bc">
      <span class="font-medium">{{ t("mcp.tools") }}</span>
      <el-button
        size="small"
        :loading="syncing"
        data-testid="mcp-drawer-sync"
        @click="runSync"
      >
        {{ t("mcp.sync") }}
      </el-button>
    </div>
    <el-table :data="tools" size="small" data-testid="mcp-tools-table">
      <el-table-column prop="name" :label="t('mcp.toolName')" min-width="140" />
      <el-table-column
        prop="description"
        :label="t('mcp.toolDescription')"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column :label="t('mcp.toolReadOnly')" width="90">
        <template #default="{ row: tool }">
          <el-tag
            :type="tool.read_only ? 'success' : 'warning'"
            size="small"
            effect="plain"
          >
            {{ tool.read_only ? t("mcp.readOnlyYes") : t("mcp.readOnlyNo") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('mcp.toolParams')" min-width="140">
        <template #default="{ row: tool }">
          {{ (tool.params ?? []).join("、") || "-" }}
        </template>
      </el-table-column>
      <el-table-column :label="t('mcp.toolCall')" width="90" fixed="right">
        <template #default="{ row: tool }">
          <el-button link type="primary" size="small" @click="pickTool(tool)">
            {{ t("mcp.toolCall") }}
          </el-button>
        </template>
      </el-table-column>
      <template #empty>{{ t("mcp.empty") }}</template>
    </el-table>

    <div class="mt-4">
      <div class="mb-2 font-medium">
        {{ t("mcp.callTitle", { name: callTool || "-" }) }}
      </div>
      <el-input
        v-model="callArguments"
        type="textarea"
        :rows="3"
        data-testid="mcp-call-arguments"
        :placeholder="t('mcp.callArgumentsTip')"
      />
      <div class="mt-2 flex items-center gap-2">
        <el-button
          type="primary"
          size="small"
          :disabled="!callTool"
          :loading="calling"
          data-testid="mcp-call-run"
          @click="runCall"
        >
          {{ t("mcp.callRun") }}
        </el-button>
        <span class="text-xs text-(--el-text-color-regular)">
          {{ t("mcp.whitelistTip") }}
        </span>
      </div>
      <div v-if="callResult" class="mt-3" data-testid="mcp-call-result">
        <div
          class="mb-1 text-xs"
          :class="
            callResult.is_error
              ? 'text-(--el-color-danger)'
              : 'text-(--el-color-success)'
          "
        >
          {{ callResult.is_error ? t("mcp.callFailed") : t("mcp.callSuccess") }}
        </div>
        <pre
          class="max-h-60 overflow-auto rounded bg-(--el-fill-color-light) p-2 text-xs break-all whitespace-pre-wrap"
          >{{ callResult.text || "-" }}</pre>
      </div>
    </div>
  </div>
</template>
