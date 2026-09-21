<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { aiAssistantApi, aiConfigApi, type AiMetrics } from "@/api/system/ai";
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
  AI_STRUCTURED_MAX_TOKENS: null as number | null
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
