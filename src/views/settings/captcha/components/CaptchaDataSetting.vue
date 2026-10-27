<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { hasAuth } from "@/router/utils";
import { useCaptchaData } from "../utils/useCaptchaData";
import CaptchaDataTopLists from "./CaptchaDataTopLists.vue";

defineOptions({ name: "CaptchaDataSetting" });

const { t, te } = useI18n();
const {
  api,
  auth,
  stats,
  statsLoading,
  statsError,
  hours,
  canViewStats,
  loadStats,
  changeWindow
} = useCaptchaData();
const canViewLog = hasAuth("list:SecurityCaptchaLog");

const windowOptions = computed(() =>
  [24, 72, 168].map(value => ({
    value,
    label: t(`settingCaptcha.dataHour${value}`)
  }))
);

const summaryCards = computed(() => {
  const summary = stats.value?.summary;
  if (!summary) return [];
  return [
    {
      key: "challenge",
      label: t("settingCaptcha.dataChallenge"),
      value: String(summary.challenge)
    },
    {
      key: "verify",
      label: t("settingCaptcha.dataVerify"),
      value: String(summary.verify)
    },
    {
      key: "passRate",
      label: t("settingCaptcha.dataPassRate"),
      value: `${Math.round(summary.pass_rate * 100)}%`
    },
    {
      key: "consume",
      label: t("settingCaptcha.dataConsume"),
      value: String(summary.consume)
    },
    {
      key: "denyRate",
      label: t("settingCaptcha.dataDenyRate"),
      value: `${Math.round(summary.deny_rate * 100)}%`
    },
    {
      key: "latencyP50",
      label: t("settingCaptcha.dataLatencyP50"),
      value: `${summary.latency_p50} ms`
    }
  ];
});

const riskRows = computed(() => stats.value?.risk_distribution ?? []);
const thresholdText = computed(() => {
  const thresholds = stats.value?.policy?.thresholds;
  if (!thresholds) return "";
  // 逐键兜底：后端调整键名时显示 "-" 而不是 "undefined/undefined/..."
  return ["allow", "light", "hard", "deny"]
    .map(key => (thresholds as Record<string, number>)[key] ?? "-")
    .join("/");
});

const typeRows = computed(() =>
  (stats.value?.by_type ?? []).map(row => {
    const key = `settingCaptcha.preview${row.type}`;
    // 服务端可能新增题型（image/pow）：缺词条时回退原始 type，不渲染 i18n key
    return { ...row, label: te(key) ? t(key) : row.type };
  })
);

const assetRows = computed(() =>
  (stats.value?.by_asset ?? []).map(row => ({
    ...row,
    label: row.asset_id || "-"
  }))
);

const decisionRows = computed(() => {
  const rows = stats.value?.by_decision ?? [];
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return rows.map(row => ({
    ...row,
    percent: total ? Math.round((row.total / total) * 100) : 0
  }));
});

const trendRows = computed(() => {
  const rows = stats.value?.trend ?? [];
  const max = rows.reduce((peak, row) => Math.max(peak, row.total), 0);
  return rows.slice(-12).map(row => ({
    ...row,
    label: row.hour.replace("T", " ").slice(5, 16),
    percent: max ? Math.round((row.total / max) * 100) : 0
  }));
});
const trendTruncated = computed(
  () => (stats.value?.trend?.length ?? 0) > trendRows.value.length
);

function decisionLabel(decision: string) {
  const key = `settingCaptcha.decision${decision.charAt(0).toUpperCase()}${decision.slice(1)}`;
  return te(key) ? t(key) : decision;
}
</script>

<template>
  <div data-testid="captcha-data-setting">
    <template v-if="canViewStats">
      <div class="mb-4 flex-bc flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <el-tag
            v-if="stats"
            size="small"
            type="info"
            data-testid="captcha-data-mode"
          >
            {{ t("settingCaptcha.dataRiskMode") }}: {{ stats.policy.risk_mode }}
          </el-tag>
          <span
            v-if="stats"
            class="text-xs text-(--el-text-color-secondary)"
            data-testid="captcha-data-retention"
          >
            {{
              t("settingCaptcha.dataRetention", {
                days: stats.policy.retention_days
              })
            }}
          </span>
          <el-tag
            v-if="thresholdText"
            size="small"
            type="info"
            data-testid="captcha-data-thresholds"
          >
            {{ t("settingCaptcha.dataThresholds") }}: {{ thresholdText }}
          </el-tag>
          <el-select
            :model-value="hours"
            size="small"
            class="captcha-data__window"
            :aria-label="t('settingCaptcha.dataWindow')"
            data-testid="captcha-data-window"
            @update:model-value="changeWindow"
          >
            <el-option
              v-for="option in windowOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button
            link
            type="primary"
            :loading="statsLoading"
            data-testid="captcha-data-refresh"
            @click="loadStats"
          >
            {{ t("settingCaptcha.dataRefresh") }}
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="statsError"
        class="mb-4"
        type="error"
        :closable="false"
        show-icon
        data-testid="captcha-data-error"
        :title="statsError"
      >
        <template #default>
          <el-button link type="primary" @click="loadStats">
            {{ t("settingCaptcha.dataRetry") }}
          </el-button>
        </template>
      </el-alert>
      <el-skeleton
        v-else-if="statsLoading && !stats"
        class="mb-4"
        :rows="4"
        animated
        data-testid="captcha-data-loading"
      />
      <p
        v-else-if="!stats"
        class="mb-4 text-sm text-(--el-text-color-secondary)"
        data-testid="captcha-data-empty"
      >
        {{ t("settingCaptcha.dataEmpty") }}
      </p>

      <div
        v-if="summaryCards.length"
        class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        data-testid="captcha-data-summary"
      >
        <div
          v-for="card in summaryCards"
          :key="card.key"
          class="rounded-lg border border-(--el-border-color-lighter) bg-(--el-bg-color) p-3"
        >
          <p class="text-xs text-(--el-text-color-secondary)">
            {{ card.label }}
          </p>
          <p class="mt-1 text-2xl font-semibold text-(--el-text-color-primary)">
            {{ card.value }}
          </p>
        </div>
      </div>

      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        <section
          class="rounded-lg border border-(--el-border-color-lighter) p-3"
          data-testid="captcha-data-by-type"
        >
          <h4 class="mb-2 text-sm font-medium">
            {{ t("settingCaptcha.dataByType") }}
          </h4>
          <p
            v-if="!typeRows.length"
            class="text-xs text-(--el-text-color-secondary)"
          >
            {{ t("settingCaptcha.dataEmpty") }}
          </p>
          <div
            v-for="row in typeRows"
            :key="row.type"
            class="flex-bc gap-3 py-1 text-sm"
          >
            <span class="w-24 shrink-0">{{ row.label }}</span>
            <span class="text-xs text-(--el-text-color-secondary)">
              {{ t("settingCaptcha.dataTotal") }} {{ row.total }} ·
              {{ t("settingCaptcha.dataPassed") }} {{ row.passed }}
            </span>
            <span class="font-medium">
              {{ Math.round(row.pass_rate * 100) }}%
            </span>
          </div>
        </section>

        <section
          class="rounded-lg border border-(--el-border-color-lighter) p-3"
          data-testid="captcha-data-by-asset"
        >
          <h4 class="mb-2 text-sm font-medium">
            {{ t("settingCaptcha.dataByAsset") }}
          </h4>
          <p
            v-if="!assetRows.length"
            class="text-xs text-(--el-text-color-secondary)"
          >
            {{ t("settingCaptcha.dataEmpty") }}
          </p>
          <div
            v-for="row in assetRows"
            :key="row.asset_id"
            class="flex-bc gap-3 py-1 text-sm"
          >
            <span class="max-w-40 truncate">{{ row.label }}</span>
            <span class="text-xs text-(--el-text-color-secondary)">
              {{ t("settingCaptcha.dataTotal") }} {{ row.total }} ·
              {{ t("settingCaptcha.dataPassed") }} {{ row.passed }}
            </span>
            <span class="font-medium">
              {{ Math.round(row.pass_rate * 100) }}%
            </span>
          </div>
        </section>

        <section
          class="rounded-lg border border-(--el-border-color-lighter) p-3"
          data-testid="captcha-data-by-decision"
        >
          <h4 class="mb-2 text-sm font-medium">
            {{ t("settingCaptcha.dataByDecision") }}
          </h4>
          <p
            v-if="!decisionRows.length"
            class="text-xs text-(--el-text-color-secondary)"
          >
            {{ t("settingCaptcha.dataEmpty") }}
          </p>
          <div
            v-for="row in decisionRows"
            :key="row.decision"
            class="flex items-center gap-2 py-1 text-sm"
          >
            <span class="w-24 shrink-0">{{ decisionLabel(row.decision) }}</span>
            <div class="h-2 flex-1 rounded-full bg-(--el-fill-color-light)">
              <div
                class="h-2 rounded-full bg-(--el-color-primary)"
                :style="{ width: `${row.percent}%` }"
              />
            </div>
            <span class="w-10 text-right text-xs">{{ row.total }}</span>
          </div>
        </section>
      </div>

      <section
        v-if="riskRows.length"
        class="mb-4 rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-risk-distribution"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataRiskDistribution") }}
        </h4>
        <div
          v-for="row in riskRows"
          :key="row.bucket"
          class="flex items-center gap-2 py-1 text-sm"
        >
          <span class="w-24 shrink-0">{{ row.bucket }}</span>
          <div class="h-2 flex-1 rounded-full bg-(--el-fill-color-light)">
            <div
              class="h-2 rounded-full bg-(--el-color-warning)"
              :style="{
                width: `${stats?.summary.verify ? Math.round((row.total / stats.summary.verify) * 100) : 0}%`
              }"
            />
          </div>
          <span class="w-10 text-right text-xs">{{ row.total }}</span>
        </div>
      </section>

      <CaptchaDataTopLists :stats="stats" />

      <section
        v-if="trendRows.length"
        class="mb-4 rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-trend"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataTrend") }}
        </h4>
        <p
          v-if="trendTruncated"
          class="mb-1 text-xs text-(--el-text-color-secondary)"
        >
          {{ t("settingCaptcha.dataTrendNote", { count: trendRows.length }) }}
        </p>
        <div
          v-for="row in trendRows"
          :key="row.hour"
          class="flex items-center gap-2 py-0.5 text-xs"
        >
          <span class="w-28 shrink-0 text-(--el-text-color-secondary)">
            {{ row.label }}
          </span>
          <div class="h-1.5 flex-1 rounded-full bg-(--el-fill-color-light)">
            <div
              class="h-1.5 rounded-full bg-(--el-color-success)"
              :style="{ width: `${row.percent}%` }"
            />
          </div>
          <span class="w-14 text-right">{{ row.total }}</span>
        </div>
      </section>
    </template>

    <template v-if="canViewLog">
      <h4 class="mb-2 text-sm font-medium">
        {{ t("settingCaptcha.dataLog") }}
      </h4>
      <RePlusPage
        :selection="false"
        :operation="false"
        :api="api"
        :auth="auth"
        locale-name="settingCaptcha"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.captcha-data__window {
  width: 132px;
}
</style>
