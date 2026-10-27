<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useCaptchaData } from "../utils/useCaptchaData";

defineOptions({ name: "CaptchaDataSetting" });

const { t, te } = useI18n();
const { api, auth, stats, statsLoading, hours, loadStats, changeWindow } =
  useCaptchaData();

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
const topReasons = computed(() => stats.value?.top_reasons ?? []);
const topIps = computed(() =>
  (stats.value?.top_ips ?? []).map(row => ({
    ...row,
    label: shortHash(row.ip_hash)
  }))
);
const topFingerprints = computed(() =>
  (stats.value?.top_fingerprints ?? []).map(row => ({
    ...row,
    label: shortHash(row.fp_hash)
  }))
);
const topUa = computed(() => stats.value?.top_ua ?? []);
const thresholdText = computed(() => {
  const thresholds = stats.value?.policy.thresholds;
  return thresholds
    ? `${thresholds.allow}/${thresholds.light}/${thresholds.hard}/${thresholds.deny}`
    : "";
});

function shortHash(value?: string) {
  return value ? `${value.slice(0, 12)}…` : "";
}

const typeRows = computed(() =>
  (stats.value?.by_type ?? []).map(row => ({
    ...row,
    label: t(`settingCaptcha.preview${row.type}`)
  }))
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

function decisionLabel(decision: string) {
  const key = `settingCaptcha.decision${decision.charAt(0).toUpperCase()}${decision.slice(1)}`;
  return te(key) ? t(key) : decision;
}
</script>

<template>
  <div data-testid="captcha-data-setting">
    <div class="mb-4 flex-bc flex-wrap gap-3">
      <p class="text-sm text-(--el-text-color-secondary)">
        {{ t("settingCaptcha.dataDesc") }}
      </p>
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
        <p class="text-xs text-(--el-text-color-secondary)">{{ card.label }}</p>
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
        v-if="assetRows.length"
        class="rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-by-asset"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataByAsset") }}
        </h4>
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

    <section
      v-if="
        topReasons.length ||
        topIps.length ||
        topFingerprints.length ||
        topUa.length
      "
      class="mb-4 grid gap-4 lg:grid-cols-4"
      data-testid="captcha-data-top"
    >
      <div
        class="rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-top-reasons"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataTopReasons") }}
        </h4>
        <p
          v-if="!topReasons.length"
          class="text-xs text-(--el-text-color-secondary)"
        >
          {{ t("settingCaptcha.dataEmpty") }}
        </p>
        <div
          v-for="row in topReasons"
          :key="row.reason"
          class="flex-bc gap-2 py-1 text-sm"
        >
          <span class="font-mono text-xs">{{ row.reason }}</span>
          <span class="text-xs">{{ row.total }}</span>
        </div>
      </div>
      <div
        class="rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-top-ips"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataTopIps") }}
        </h4>
        <p
          v-if="!topIps.length"
          class="text-xs text-(--el-text-color-secondary)"
        >
          {{ t("settingCaptcha.dataEmpty") }}
        </p>
        <div
          v-for="row in topIps"
          :key="row.ip_hash"
          class="flex-bc gap-2 py-1 text-sm"
        >
          <span class="font-mono text-xs">{{ row.label }}</span>
          <span class="text-xs">{{ row.total }}</span>
        </div>
      </div>
      <div
        class="rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-top-fingerprints"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataTopFingerprints") }}
        </h4>
        <p
          v-if="!topFingerprints.length"
          class="text-xs text-(--el-text-color-secondary)"
        >
          {{ t("settingCaptcha.dataEmpty") }}
        </p>
        <div
          v-for="row in topFingerprints"
          :key="row.fp_hash"
          class="flex-bc gap-2 py-1 text-sm"
        >
          <span class="font-mono text-xs">{{ row.label }}</span>
          <span class="text-xs">{{ row.total }}</span>
        </div>
      </div>
      <div
        class="rounded-lg border border-(--el-border-color-lighter) p-3"
        data-testid="captcha-data-top-ua"
      >
        <h4 class="mb-2 text-sm font-medium">
          {{ t("settingCaptcha.dataTopUa") }}
        </h4>
        <p
          v-if="!topUa.length"
          class="text-xs text-(--el-text-color-secondary)"
        >
          {{ t("settingCaptcha.dataEmpty") }}
        </p>
        <div
          v-for="row in topUa"
          :key="row.ua_class"
          class="flex-bc gap-2 py-1 text-sm"
        >
          <span class="text-xs">{{ row.ua_class }}</span>
          <span class="text-xs">{{ row.total }}</span>
        </div>
      </div>
    </section>

    <section
      v-if="trendRows.length"
      class="mb-4 rounded-lg border border-(--el-border-color-lighter) p-3"
      data-testid="captcha-data-trend"
    >
      <h4 class="mb-2 text-sm font-medium">
        {{ t("settingCaptcha.dataTrend") }}
      </h4>
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

    <h4 class="mb-2 text-sm font-medium">{{ t("settingCaptcha.dataLog") }}</h4>
    <RePlusPage
      :selection="false"
      :operation="false"
      :api="api"
      :auth="auth"
      locale-name="settingCaptcha"
    />
  </div>
</template>

<style lang="scss" scoped>
.captcha-data__window {
  width: 132px;
}
</style>
