<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";

import { ReImageCaptcha } from "@/components/ReImageCaptcha";
import { ReCaptchaPuzzle } from "@/components/ReCaptchaPuzzle";
import { ReRotateCaptcha } from "@/components/ReRotateCaptcha";
import { ReWordClickCaptcha } from "@/components/ReWordClickCaptcha";
import type { CaptchaChallengeData } from "@/api/auth";
import type { CaptchaSubmitPayload } from "./types";

defineOptions({ name: "ReCaptchaPanel" });

defineProps<{
  challenge: CaptchaChallengeData | null;
  loading: boolean;
  submitting: boolean;
  error: string;
  success: boolean;
  imageFallback?: boolean;
  shake?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CaptchaSubmitPayload];
  refresh: [];
  fallback: [];
}>();

const { t } = useI18n();
const childRef = ref<{
  reset?: () => void;
  markSuccess?: () => void;
} | null>(null);

function reset() {
  childRef.value?.reset?.();
}

function markSuccess() {
  childRef.value?.markSuccess?.();
}

defineExpose({ reset, markSuccess });
</script>

<template>
  <div
    class="re-captcha-panel"
    :class="{ 'is-shaking': shake }"
    data-testid="captcha-panel"
    :data-challenge-id="challenge?.challenge_id"
    :data-challenge-type="challenge?.type"
    :data-width="challenge?.width"
    :data-height="challenge?.height"
    :data-piece-size="challenge?.piece_size"
  >
    <div class="re-captcha-panel__head">
      <span class="re-captcha-panel__title">{{
        t("captchaChallenge.challengeTitle")
      }}</span>
      <div class="re-captcha-panel__actions">
        <el-button
          v-if="imageFallback"
          link
          :disabled="loading || submitting"
          @click="emit('fallback')"
        >
          {{ t("captchaChallenge.imageFallback") }}
        </el-button>
        <el-button
          link
          type="primary"
          :disabled="loading || submitting"
          @click="emit('refresh')"
        >
          {{ t("captchaChallenge.refresh") }}
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="error"
      class="mb-3!"
      type="error"
      :closable="false"
      show-icon
      :title="error"
    />

    <div v-loading="loading || submitting" class="re-captcha-panel__body">
      <template v-if="challenge">
        <ReImageCaptcha
          v-if="challenge.type === 'image'"
          ref="childRef"
          :challenge="challenge"
          :submitting="submitting"
          @submit="emit('submit', $event)"
        />
        <ReCaptchaPuzzle
          v-else-if="challenge.type === 'slide'"
          ref="childRef"
          :challenge="challenge"
          @submit="emit('submit', $event)"
        />
        <ReRotateCaptcha
          v-else-if="challenge.type === 'rotate'"
          ref="childRef"
          :challenge="challenge"
          @submit="emit('submit', $event)"
        />
        <ReWordClickCaptcha
          v-else-if="
            challenge.type === 'click' ||
            challenge.type === 'wordorder' ||
            challenge.type === 'icon'
          "
          ref="childRef"
          :challenge="challenge"
          @submit="emit('submit', $event)"
        />
      </template>
      <div v-else class="re-captcha-panel__placeholder">
        {{ error || t("captchaChallenge.loadFailed") }}
      </div>

      <Transition name="captcha-success">
        <div
          v-if="success"
          class="re-captcha-panel__success"
          role="status"
          aria-live="polite"
        >
          <span class="re-captcha-panel__success-text">
            {{ t("captchaChallenge.success") }}
          </span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-captcha-panel {
  width: 100%;

  &.is-shaking {
    animation: captcha-shake 0.4s var(--ease-standard);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  &__title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__body {
    position: relative;
    min-height: 120px;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    font-size: var(--font-size-base);
    color: var(--el-text-color-secondary);
  }

  &__success {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--el-bg-color) 88%, transparent);
  }

  &__success-text {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--el-color-success);
  }
}

@keyframes captcha-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-6px);
  }

  75% {
    transform: translateX(6px);
  }
}

.captcha-success-enter-active,
.captcha-success-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.captcha-success-enter-from,
.captcha-success-leave-to {
  opacity: 0;
}
</style>
