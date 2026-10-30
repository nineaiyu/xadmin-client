<script lang="ts" setup>
import { useI18n } from "vue-i18n";

import type { CaptchaChallengeData } from "@/api/auth";

defineOptions({ name: "ReCaptchaPow" });

defineProps<{
  challenge: CaptchaChallengeData | null;
  submitting: boolean;
  error: string;
  imageFallback?: boolean;
}>();

const emit = defineEmits<{
  solve: [];
  refresh: [];
  fallback: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="re-captcha-pow"
    role="group"
    :aria-label="t('captchaChallenge.powTitle')"
    data-testid="captcha-pow"
  >
    <div class="re-captcha-pow__head">
      <span class="re-captcha-pow__title">{{
        t("captchaChallenge.powTitle")
      }}</span>
      <div class="flex items-center gap-2">
        <el-button
          v-if="imageFallback"
          link
          :disabled="submitting"
          @click="emit('fallback')"
        >
          {{ t("captchaChallenge.imageFallback") }}
        </el-button>
        <el-button
          link
          type="primary"
          :disabled="submitting"
          @click="emit('refresh')"
        >
          {{ t("captchaChallenge.refresh") }}
        </el-button>
      </div>
    </div>

    <p class="re-captcha-pow__tip" aria-live="polite">
      {{
        submitting
          ? t("captchaChallenge.powRunning")
          : t("captchaChallenge.powTip")
      }}
    </p>

    <el-alert
      v-if="error"
      class="mb-3!"
      type="error"
      :closable="false"
      show-icon
      :title="error"
    />

    <div class="re-captcha-pow__actions">
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!challenge?.pow"
        data-testid="captcha-pow-solve"
        @click="emit('solve')"
      >
        {{ t("captchaChallenge.powAction") }}
      </el-button>
      <span class="re-captcha-pow__hint">
        {{ t("captchaChallenge.powHint") }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-captcha-pow {
  padding: var(--space-3);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
}

.re-captcha-pow__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.re-captcha-pow__title {
  font-size: var(--el-font-size-base);
  font-weight: 600;
}

.re-captcha-pow__tip {
  margin-bottom: var(--space-2);
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.re-captcha-pow__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.re-captcha-pow__hint {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-regular);
}
</style>
