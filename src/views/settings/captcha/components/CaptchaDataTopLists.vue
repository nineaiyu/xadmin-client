<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { CaptchaStatsData } from "@/api/system/settings";

defineOptions({ name: "CaptchaDataTopLists" });

const props = defineProps<{ stats: CaptchaStatsData | null }>();
const { t } = useI18n();

const shortHash = (value?: string) => (value ? `${value.slice(0, 12)}…` : "");
const topReasons = computed(() => props.stats?.top_reasons ?? []);
const topIps = computed(() =>
  (props.stats?.top_ips ?? []).map(row => ({
    ...row,
    label: shortHash(row.ip_hash)
  }))
);
const topFingerprints = computed(() =>
  (props.stats?.top_fingerprints ?? []).map(row => ({
    ...row,
    label: shortHash(row.fp_hash)
  }))
);
const topUa = computed(() => props.stats?.top_ua ?? []);
const hasAny = computed(
  () =>
    topReasons.value.length > 0 ||
    topIps.value.length > 0 ||
    topFingerprints.value.length > 0 ||
    topUa.value.length > 0
);
</script>

<template>
  <section
    v-if="hasAny"
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
      <p v-if="!topIps.length" class="text-xs text-(--el-text-color-secondary)">
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
      <p v-if="!topUa.length" class="text-xs text-(--el-text-color-secondary)">
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
</template>
