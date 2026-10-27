<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { isSuccess } from "@/api/types";
import {
  settingsCaptchaRiskApi,
  type CaptchaRule
} from "@/api/system/settings";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";

defineOptions({ name: "CaptchaRiskSetting" });

const props = defineProps<{ item: settingItemProps }>();
const { t } = useI18n();
const rules = ref<CaptchaRule[]>([]);
const loading = ref(false);
const saving = ref(false);
const canEditRules = hasAuth("rules:SecurityCaptchaRisk");

async function load() {
  loading.value = true;
  try {
    const res = await settingsCaptchaRiskApi.rules();
    rules.value = isSuccess(res) ? res.data : [];
  } catch {
    rules.value = [];
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const res = await settingsCaptchaRiskApi.saveRules(
      rules.value.map(rule => ({
        code: rule.code,
        score: rule.score,
        enabled: rule.enabled,
        priority: rule.priority
      }))
    );
    if (isSuccess(res)) {
      message(t("settingCaptcha.riskRulesSaved"), { type: "success" });
      rules.value = res.data;
    } else {
      message(res.detail || t("settingCaptcha.riskRulesFailed"), {
        type: "error"
      });
    }
  } catch {
    message(t("settingCaptcha.riskRulesFailed"), { type: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <SettingItem v-bind="props.item" />

  <section
    v-loading="loading"
    class="mt-4 rounded-lg border border-(--el-border-color-lighter) p-3"
    data-testid="captcha-risk-rules"
  >
    <div class="mb-2 flex-bc gap-3">
      <div>
        <h4 class="text-sm font-medium">{{ t("settingCaptcha.riskRules") }}</h4>
        <p class="text-xs text-(--el-text-color-secondary)">
          {{ t("settingCaptcha.riskRulesDesc") }}
        </p>
      </div>
      <el-button
        v-if="canEditRules"
        type="primary"
        size="small"
        :loading="saving"
        data-testid="captcha-risk-rules-save"
        @click="save"
      >
        {{ t("settingCaptcha.riskRuleSave") }}
      </el-button>
    </div>
    <div
      v-for="rule in rules"
      :key="rule.code"
      class="flex items-center gap-3 border-t border-(--el-border-color-lighter) py-2 text-sm"
    >
      <span class="flex-1 font-mono text-xs">{{ rule.code }}</span>
      <el-tooltip :content="rule.name" placement="top">
        <span class="w-24 text-xs text-(--el-text-color-secondary)">
          {{ rule.name }}
        </span>
      </el-tooltip>
      <el-input-number
        v-model="rule.score"
        :disabled="!canEditRules"
        size="small"
        :min="-100"
        :max="100"
        :aria-label="t('settingCaptcha.riskRuleScore')"
        class="captcha-risk__score"
      />
      <el-switch
        v-model="rule.enabled"
        :disabled="!canEditRules"
        size="small"
        :aria-label="t('settingCaptcha.riskRuleEnabled')"
      />
    </div>
  </section>

  <p
    class="mt-4 text-xs text-(--el-text-color-secondary)"
    data-testid="captcha-risk-compliance"
  >
    {{ t("settingCaptcha.riskCompliance") }}
  </p>
</template>

<style lang="scss" scoped>
.captcha-risk__score {
  width: 104px;
}
</style>
