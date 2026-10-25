<script lang="ts" setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import DataTable from "@/components/DataTable";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import {
  mcpCallLogApi,
  type McpCallLogItem,
  type McpServerItem
} from "@/api/ai/mcp";

/**
 * MCP 调用审计抽屉（提案 P5 治理面）：单服务器的调用流水（数据源
 * OperationLog module=AI:mcp:client）。只读报表——成功/失败、渠道、耗时、
 * 结果摘要；无任何删除入口（审计痕迹不可灭迹）。
 */
defineOptions({ name: "McpCallLogsDrawer" });

const props = defineProps<{ server: McpServerItem | null }>();

const { t } = useI18n();

const loading = ref(false);
const rows = ref<McpCallLogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
/** 结果过滤：all / ok / failed */
const outcome = ref<"all" | "ok" | "failed">("all");

const channelText = (channel: string) =>
  channel === "mcp_tool" ? t("mcp.logChannelAi") : t("mcp.logChannelAdmin");

const load = async () => {
  if (!props.server) return;
  loading.value = true;
  try {
    // 异常归一为信封：403 / 网络错误必须显式提示，否则会被读成「0 条记录」
    const res = await mcpCallLogApi
      .list<McpCallLogItem>({
        page: page.value,
        size: pageSize,
        object_pk: props.server.pk,
        ordering: "-created_time",
        // 服务端 ok 是布尔过滤器（?ok=false 取失败行）：传 "failed" 会被当空值忽略
        ...(outcome.value === "all" ? {} : { ok: outcome.value === "ok" })
      })
      .catch(
        (error: { detail?: string; message?: string } | null | undefined) => ({
          code: -1,
          data: null,
          detail: error?.detail ?? error?.message
        })
      );
    if (!isSuccess(res)) {
      rows.value = [];
      total.value = 0;
      message(String(res?.detail || t("results.failed")), { type: "error" });
      return;
    }
    rows.value = res.data?.results ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

// 纯内容形态（宿主 addDrawer 提供抽屉壳）：挂载即首拉，服务器行切换时重置分页重拉
watch(
  () => props.server?.pk,
  () => {
    page.value = 1;
    outcome.value = "all";
    void load();
  },
  { immediate: true }
);

const handlePage = (next: number) => {
  page.value = next;
  void load();
};

const handleOutcome = () => {
  page.value = 1;
  void load();
};
</script>

<template>
  <div data-testid="mcp-call-logs-drawer">
    <div class="mb-2 flex items-center gap-2">
      <el-radio-group v-model="outcome" size="small" @change="handleOutcome">
        <el-radio-button value="all">
          {{ t("mcp.logOutcomeAll") }}
        </el-radio-button>
        <el-radio-button value="ok">
          {{ t("mcp.logOutcomeOk") }}
        </el-radio-button>
        <el-radio-button value="failed">
          {{ t("mcp.logOutcomeFailed") }}
        </el-radio-button>
      </el-radio-group>
      <span class="text-xs text-fg-muted">
        {{ t("mcp.logTotal", { count: total }) }}
      </span>
    </div>
    <DataTable
      v-loading="loading"
      :data="rows"
      :label="t('mcp.logs')"
      size="small"
      data-testid="mcp-call-logs-table"
    >
      <el-table-column
        prop="created_time"
        :label="t('mcp.logColTime')"
        width="150"
      >
        <template #default="{ row }">
          {{ dayjs(row.created_time).format("MM-DD HH:mm:ss") }}
        </template>
      </el-table-column>
      <el-table-column prop="tool" :label="t('mcp.logColTool')" width="140" />
      <el-table-column prop="creator" :label="t('mcp.logColUser')" width="110">
        <template #default="{ row }">
          {{ row.creator?.username ?? "-" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="channel"
        :label="t('mcp.logColChannel')"
        width="90"
      >
        <template #default="{ row }">
          {{ channelText(row.channel) }}
        </template>
      </el-table-column>
      <el-table-column prop="ok" :label="t('mcp.logColResult')" width="80">
        <template #default="{ row }">
          <el-tag :type="row.ok ? 'success' : 'danger'" size="small">
            {{ row.ok ? t("mcp.logOk") : t("mcp.logFailed") }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="detail" :label="t('mcp.logColDetail')">
        <template #default="{ row }">
          <span class="text-xs break-all">{{ row.detail || "-" }}</span>
        </template>
      </el-table-column>
    </DataTable>
    <el-pagination
      v-if="total > pageSize"
      class="mt-3 justify-end"
      layout="prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="handlePage"
    />
  </div>
</template>
