<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  aiAssistantApi,
  aiConfigApi,
  type AiMetrics,
  type AiUsageSummary
} from "@/api/system/ai";
import { useAiProfiles } from "./utils/useAiProfiles";

defineOptions({
  name: "AiAssistantConfig"
});

const { t } = useI18n();
// 全局开关走 Setting 通路权限（档案未激活时仍生效）
const canEditGlobal = hasAuth("partialUpdate:AiAssistantConfig");
const canReadGlobal = hasAuth("list:AiAssistantConfig");

const globalLoading = ref(false);
const globalForm = reactive({
  AI_ASSISTANT_ENABLED: false,
  AI_NL_QUERY_ENABLED: false,
  AI_ACTION_ENABLED: false,
  AI_STRUCTURED_MAX_TOKENS: null as number | null,
  // AI-2 原生工具调用双轨（结构化链路，需档案探测通过 tool_calls）
  AI_NATIVE_TOOLS_ENABLED: false,
  // AI-5 用量配额（0 = 不限）
  AI_QUOTA_USER_DAILY_CALLS: 0,
  AI_QUOTA_USER_DAILY_TOKENS: 0,
  AI_QUOTA_MAX_CONCURRENT_STREAMS: 0
});

const loadGlobal = async () => {
  if (!canReadGlobal) return;
  globalLoading.value = true;
  try {
    const res = await aiConfigApi.retrieve();
    if (res.code === SUCCESS_CODE) {
      const data = res.data as Record<string, unknown>;
      globalForm.AI_ASSISTANT_ENABLED = Boolean(data?.AI_ASSISTANT_ENABLED);
      globalForm.AI_NL_QUERY_ENABLED = Boolean(data?.AI_NL_QUERY_ENABLED);
      globalForm.AI_ACTION_ENABLED = Boolean(data?.AI_ACTION_ENABLED);
      globalForm.AI_STRUCTURED_MAX_TOKENS =
        (data?.AI_STRUCTURED_MAX_TOKENS as number | null) ?? null;
      globalForm.AI_NATIVE_TOOLS_ENABLED = Boolean(
        data?.AI_NATIVE_TOOLS_ENABLED
      );
      globalForm.AI_QUOTA_USER_DAILY_CALLS = Number(
        data?.AI_QUOTA_USER_DAILY_CALLS ?? 0
      );
      globalForm.AI_QUOTA_USER_DAILY_TOKENS = Number(
        data?.AI_QUOTA_USER_DAILY_TOKENS ?? 0
      );
      globalForm.AI_QUOTA_MAX_CONCURRENT_STREAMS = Number(
        data?.AI_QUOTA_MAX_CONCURRENT_STREAMS ?? 0
      );
    }
  } finally {
    globalLoading.value = false;
  }
};

const saveGlobal = async () => {
  // 异常归一为可读失败结果：PATCH 失败（网络/HTTP 层）不能让 Promise 未处理
  const res = await aiConfigApi
    .partialUpdate({}, { ...globalForm })
    .catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
  if (res.code === SUCCESS_CODE) {
    message(t("aiConfig.globalSaved"), { type: "success" });
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

/* ---------------- B1 调用观测（权限复用 status:AiAssistant） ---------------- */
const canReadMetrics = hasAuth("status:AiAssistant");
const metricsLoading = ref(false);
const metricsDays = ref(30);
const metrics = ref<AiMetrics | null>(null);
const metricsCards = computed(() => {
  const data = metrics.value;
  const total = data?.total ?? 0;
  const success = data?.success ?? 0;
  const failed = data?.failed ?? 0;
  // 无调用（total=0）时成功率为 0：显示 100% 会被误读为"全部成功"
  const rate = total ? Math.round((success / total) * 100) : 0;
  return [
    { label: t("aiConfig.metricsTotal"), value: String(total) },
    { label: t("aiConfig.metricsSuccess"), value: String(success) },
    { label: t("aiConfig.metricsFailed"), value: String(failed) },
    { label: t("aiConfig.metricsRate"), value: `${rate}%` },
    {
      label: t("aiConfig.metricsTokens"),
      value: (data?.tokens?.total ?? 0).toLocaleString()
    }
  ];
});

const loadMetrics = async () => {
  if (!canReadMetrics) return;
  metricsLoading.value = true;
  try {
    const res = await aiAssistantApi.metrics(metricsDays.value);
    if (res.code === SUCCESS_CODE) {
      metrics.value = res.data as unknown as AiMetrics;
    }
  } finally {
    metricsLoading.value = false;
  }
};

const metricPercent = (count: number) => {
  const max = Math.max(
    1,
    ...(metrics.value?.by_module ?? []).map(row => row.count)
  );
  return Math.round((count / max) * 100);
};

/* ---------------- AI-5 用量账本（权限复用 status:AiAssistant） ---------------- */
const usageLoading = ref(false);
const usageDays = ref(7);
const usage = ref<AiUsageSummary | null>(null);
const usageCards = computed(() => [
  {
    label: t("aiConfig.usageCalls"),
    value: String(usage.value?.total_calls ?? 0)
  },
  {
    label: t("aiConfig.usageTokens"),
    value: (usage.value?.total_tokens ?? 0).toLocaleString()
  },
  { label: t("aiConfig.usageFailed"), value: String(usage.value?.failed ?? 0) },
  {
    label: t("aiConfig.quotaStreams"),
    value: `${usage.value?.stream_slots ?? 0}/${
      usage.value?.quota?.concurrent_streams || "∞"
    }`
  }
]);

const loadUsage = async () => {
  if (!canReadMetrics) return;
  usageLoading.value = true;
  try {
    const res = await aiAssistantApi.usage(usageDays.value);
    if (res.code === SUCCESS_CODE) {
      usage.value = res.data as AiUsageSummary;
    }
  } finally {
    usageLoading.value = false;
  }
};

/* ---------------- 配置档案（RePlusPage） ---------------- */
const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useAiProfiles(tableRef);

onMounted(() => {
  loadGlobal();
  loadMetrics();
  loadUsage();
});
</script>

<template>
  <div>
    <!-- 全局开关：Setting 回落通路（档案未激活时仍生效） -->
    <el-card
      v-if="canReadGlobal"
      v-loading="globalLoading"
      shadow="never"
      class="w-99/100 mb-3"
    >
      <div class="flex flex-wrap items-center gap-6">
        <span class="font-semibold">{{ t("aiConfig.globalTitle") }}</span>
        <el-switch
          v-model="globalForm.AI_ASSISTANT_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.assistantEnabled')"
          data-testid="ai-assistant-enabled"
        />
        <el-switch
          v-model="globalForm.AI_NL_QUERY_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.nlQueryEnabled')"
          data-testid="ai-nl-query-enabled"
        />
        <el-switch
          v-model="globalForm.AI_ACTION_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.actionEnabled')"
          data-testid="ai-action-enabled"
        />
        <span
          class="text-xs text-(--el-text-color-secondary)"
          :title="t('aiConfig.structuredMaxTokensHint')"
        >
          {{ t("aiConfig.structuredMaxTokens") }}
        </span>
        <el-input-number
          v-model="globalForm.AI_STRUCTURED_MAX_TOKENS"
          :min="0"
          :step="512"
          :disabled="!canEditGlobal"
          :placeholder="t('aiConfig.structuredMaxTokensPlaceholder')"
          controls-position="right"
          data-testid="ai-structured-max-tokens"
        />
        <el-button v-if="canEditGlobal" type="primary" @click="saveGlobal">
          {{ t("aiConfig.globalSave") }}
        </el-button>
      </div>
      <!-- AI-2 双轨 + AI-5 配额：与全局开关同一保存出口 -->
      <div class="flex flex-wrap items-center gap-6 mt-3">
        <el-switch
          v-model="globalForm.AI_NATIVE_TOOLS_ENABLED"
          :disabled="!canEditGlobal"
          :active-text="t('aiConfig.nativeTools')"
          :title="t('aiConfig.nativeToolsHint')"
          data-testid="ai-native-tools-enabled"
        />
        <span class="text-xs text-(--el-text-color-secondary)">
          {{ t("aiConfig.quotaTitle") }}
        </span>
        <el-input-number
          v-model="globalForm.AI_QUOTA_USER_DAILY_CALLS"
          :min="0"
          :step="10"
          :disabled="!canEditGlobal"
          :placeholder="t('aiConfig.quotaCalls')"
          :title="t('aiConfig.quotaCalls')"
          controls-position="right"
          data-testid="ai-quota-calls"
        />
        <el-input-number
          v-model="globalForm.AI_QUOTA_USER_DAILY_TOKENS"
          :min="0"
          :step="10000"
          :disabled="!canEditGlobal"
          :placeholder="t('aiConfig.quotaTokens')"
          :title="t('aiConfig.quotaTokens')"
          controls-position="right"
          data-testid="ai-quota-tokens"
        />
        <el-input-number
          v-model="globalForm.AI_QUOTA_MAX_CONCURRENT_STREAMS"
          :min="0"
          :step="1"
          :disabled="!canEditGlobal"
          :placeholder="t('aiConfig.quotaStreams')"
          :title="t('aiConfig.quotaStreams')"
          controls-position="right"
          data-testid="ai-quota-streams"
        />
      </div>
    </el-card>

    <!-- B1 调用观测：近 N 天用量 / 成功率 / 类型分布 / 活跃用户 -->
    <el-card
      v-if="canReadMetrics"
      v-loading="metricsLoading"
      shadow="never"
      class="w-99/100 mb-3"
    >
      <div class="flex flex-wrap items-center gap-4 mb-3">
        <span class="font-semibold">{{ t("aiConfig.metricsTitle") }}</span>
        <el-radio-group
          v-model="metricsDays"
          size="small"
          @change="loadMetrics"
        >
          <el-radio-button :value="7">7</el-radio-button>
          <el-radio-button :value="30">30</el-radio-button>
          <el-radio-button :value="90">90</el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex flex-wrap gap-10 mb-3">
        <div v-for="card in metricsCards" :key="card.label">
          <div class="text-sm opacity-70">{{ card.label }}</div>
          <div class="text-2xl font-semibold">{{ card.value }}</div>
        </div>
      </div>
      <div v-if="metrics?.by_module?.length" class="mb-3">
        <div class="text-sm opacity-70 mb-1">
          {{ t("aiConfig.metricsModule") }}
        </div>
        <div
          v-for="row in metrics.by_module"
          :key="row.module"
          class="flex items-center gap-3 mb-1"
        >
          <span class="inline-block w-24 text-sm">{{ row.label }}</span>
          <el-progress
            class="flex-1"
            :percentage="metricPercent(row.count)"
            :format="() => String(row.count)"
          />
        </div>
      </div>
      <div v-if="metrics?.top_users?.length">
        <div class="text-sm opacity-70 mb-1">
          {{ t("aiConfig.metricsTopUsers") }}
        </div>
        <el-tag
          v-for="row in metrics.top_users"
          :key="row.username"
          class="mr-2 mb-1"
          type="info"
        >
          {{ row.username }} · {{ row.count }}
        </el-tag>
      </div>
    </el-card>

    <!-- AI-5 用量账本：按天 / 链路 / 用户（与调用观测量表互补：观测看成功率，账本看成本） -->
    <el-card
      v-if="canReadMetrics"
      v-loading="usageLoading"
      shadow="never"
      class="w-99/100 mb-3"
    >
      <div class="flex flex-wrap items-center gap-4 mb-3">
        <span class="font-semibold">{{ t("aiConfig.usageTitle") }}</span>
        <el-radio-group v-model="usageDays" size="small" @change="loadUsage">
          <el-radio-button :value="1">1</el-radio-button>
          <el-radio-button :value="7">7</el-radio-button>
          <el-radio-button :value="30">30</el-radio-button>
        </el-radio-group>
        <span class="text-xs text-(--el-text-color-secondary)">
          {{ t("aiConfig.usageHint") }}
        </span>
      </div>
      <div class="flex flex-wrap gap-10 mb-3">
        <div v-for="card in usageCards" :key="card.label">
          <div class="text-sm opacity-70">{{ card.label }}</div>
          <div class="text-2xl font-semibold">{{ card.value }}</div>
        </div>
      </div>
      <div v-if="usage?.by_feature?.length" class="flex flex-wrap gap-2 mb-2">
        <el-tag
          v-for="row in usage.by_feature"
          :key="row.feature"
          type="info"
          size="small"
        >
          {{ row.feature }} · {{ row.calls }} ·
          {{ row.tokens.toLocaleString() }}
        </el-tag>
      </div>
      <!-- AI-2 双轨对照：动作草稿链路的原生 / prompt 轨道成功率（弱模型占比低到阈值后评估下线 prompt 轨） -->
      <div v-if="usage?.by_track?.length" class="flex flex-wrap gap-2 mb-2">
        <el-tag
          v-for="row in usage.by_track"
          :key="row.track"
          type="warning"
          size="small"
        >
          {{ t("aiConfig.trackTitle") }}:
          {{
            row.track === "native"
              ? t("aiConfig.trackNative")
              : t("aiConfig.trackPrompt")
          }}
          · {{ row.calls }} · {{ row.success_rate }}%
        </el-tag>
      </div>
      <div v-if="usage?.top_users?.length" class="flex flex-wrap gap-2">
        <el-tag v-for="row in usage.top_users" :key="row.username" size="small">
          {{ row.username }} · {{ row.tokens.toLocaleString() }}
        </el-tag>
      </div>
    </el-card>

    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="aiConfig"
      :selection="false"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
    />
  </div>
</template>
