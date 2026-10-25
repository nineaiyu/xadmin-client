<script lang="ts" setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
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

const visible = defineModel<boolean>({ default: false });

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
    const res = await mcpCallLogApi
      .list<McpCallLogItem>({
        page: page.value,
        size: pageSize,
        object_pk: props.server.pk,
        ordering: "-created_time",
        ...(outcome.value === "all" ? {} : { ok: outcome.value })
      })
      .catch(() => null);
    rows.value = res?.data?.results ?? [];
    total.value = res?.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [visible.value, props.server?.pk],
  ([opened]) => {
    if (opened) {
      page.value = 1;
      outcome.value = "all";
      void load();
    }
  },
  // immediate：挂载时已打开（测试/复用场景）也能首拉
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
  <el-drawer
    v-model="visible"
    :title="`${t('mcp.logs')} · ${server?.name ?? ''}`"
    size="640px"
    data-testid="mcp-call-logs-drawer"
  >
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
    <el-table
      v-loading="loading"
      :data="rows"
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
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      class="mt-3 justify-end"
      layout="prev, pager, next"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="handlePage"
    />
  </el-drawer>
</template>
