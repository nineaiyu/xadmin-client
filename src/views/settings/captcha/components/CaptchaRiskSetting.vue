<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { isSuccess } from "@/api/types";
import {
  settingsCaptchaRiskApi,
  type CaptchaRule
} from "@/api/system/settings";
import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import type { settingItemProps } from "@/views/settings/components/settings-shell/types";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";

defineOptions({ name: "CaptchaRiskSetting" });

const props = defineProps<{ item: settingItemProps }>();
const { t } = useI18n();
const rules = ref<CaptchaRule[]>([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const savedSnapshot = ref("");
const canEditRules = hasAuth("rules:SecurityCaptchaRisk");

function snapshot(rows: CaptchaRule[]): string {
  return JSON.stringify(
    rows.map(rule => ({
      code: rule.code,
      score: rule.score,
      enabled: rule.enabled,
      priority: rule.priority
    }))
  );
}

const dirty = computed(
  () => !!savedSnapshot.value && snapshot(rules.value) !== savedSnapshot.value
);

// 规则未保存时离开页面/刷新会丢失：路由离开走确认，刷新走浏览器原生确认
useDesignerGuard({ dirty, namespace: "settingCaptcha", mode: "page" });

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const res = await settingsCaptchaRiskApi.rules();
    if (isSuccess(res)) {
      rules.value = res.data ?? [];
      savedSnapshot.value = snapshot(rules.value);
    } else {
      rules.value = [];
      loadError.value = String(
        res.detail || t("settingCaptcha.riskRulesLoadFailed")
      );
    }
  } catch (error) {
    rules.value = [];
    loadError.value =
      normalizeError(error).detail || t("settingCaptcha.riskRulesLoadFailed");
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (saving.value) return;
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
      rules.value = res.data ?? rules.value;
      savedSnapshot.value = snapshot(rules.value);
    } else {
      message(res.detail || t("settingCaptcha.riskRulesFailed"), {
        type: "error"
      });
    }
  } catch (error) {
    message(
      normalizeError(error).detail || t("settingCaptcha.riskRulesFailed"),
      {
        type: "error"
      }
    );
  } finally {
    saving.value = false;
  }
}

function resetDraft() {
  void load();
}

onMounted(load);
</script>

<template>
  <div class="captcha-risk">
    <SettingItem v-bind="props.item" />

    <el-alert
      class="mt-4"
      type="info"
      :closable="false"
      show-icon
      data-testid="captcha-risk-guide"
    >
      <template #title>{{ t("settingCaptcha.riskGuideTitle") }}</template>
      <ul class="captcha-risk__guide">
        <li>{{ t("settingCaptcha.riskGuide1") }}</li>
        <li>{{ t("settingCaptcha.riskGuide2") }}</li>
        <li>{{ t("settingCaptcha.riskGuide3") }}</li>
      </ul>
    </el-alert>

    <section
      v-loading="loading"
      class="mt-4 rounded-lg border border-(--el-border-color-lighter) p-3"
      data-testid="captcha-risk-rules"
    >
      <div class="mb-2 flex-bc gap-3">
        <div>
          <h4 class="text-sm font-medium">
            {{ t("settingCaptcha.riskRules") }}
          </h4>
          <p class="text-xs text-(--el-text-color-secondary)">
            {{ t("settingCaptcha.riskRulesDesc") }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            v-if="canEditRules && dirty"
            link
            size="small"
            data-testid="captcha-risk-rules-reload"
            @click="resetDraft"
          >
            {{ t("settingCaptcha.riskRuleReload") }}
          </el-button>
          <el-button
            v-if="canEditRules"
            type="primary"
            size="small"
            :loading="saving"
            :disabled="loading || !rules.length || !dirty"
            data-testid="captcha-risk-rules-save"
            @click="save"
          >
            {{ t("settingCaptcha.riskRuleSave") }}
          </el-button>
        </div>
      </div>

      <div
        v-if="loadError"
        class="flex items-center gap-2 py-2 text-sm text-(--el-color-danger)"
        data-testid="captcha-risk-rules-error"
      >
        <span>{{ loadError }}</span>
        <el-button link type="primary" size="small" @click="load">
          {{ t("settingCaptcha.riskRuleRetry") }}
        </el-button>
      </div>
      <p
        v-else-if="!loading && !rules.length"
        class="py-2 text-sm text-(--el-text-color-secondary)"
        data-testid="captcha-risk-rules-empty"
      >
        {{ t("settingCaptcha.riskRulesEmpty") }}
      </p>

      <div
        v-for="rule in rules"
        :key="rule.code"
        class="captcha-risk__row border-t border-(--el-border-color-lighter) py-2 text-sm"
      >
        <span class="font-mono text-xs">{{ rule.code }}</span>
        <el-tooltip :content="rule.name" placement="top">
          <span class="text-xs text-(--el-text-color-secondary)">
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
        <el-input-number
          v-model="rule.priority"
          :disabled="!canEditRules"
          size="small"
          :min="1"
          :max="9999"
          :aria-label="t('settingCaptcha.riskRulePriority')"
          class="captcha-risk__priority"
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
  </div>
</template>

<style lang="scss" scoped>
.captcha-risk__score {
  width: 104px;
}

.captcha-risk__priority {
  width: 96px;
}

.captcha-risk__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;

  & > :first-child {
    flex: 1;
  }

  & > :nth-child(2) {
    width: 6rem;
  }
}

.captcha-risk__guide {
  padding-left: 1.25rem;
  margin: var(--space-1) 0 0;
  line-height: 1.6;
  list-style: disc;
}
</style>
