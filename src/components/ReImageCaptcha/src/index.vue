<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import type { CaptchaChallengeData } from "@/api/auth";
import { solvePow } from "@/utils/captchaSignal/pow";
import type { CaptchaSubmitPayload } from "@/components/ReCaptchaChallenge/src/types";

defineOptions({ name: "ReImageCaptcha" });

const props = defineProps<{
  challenge: CaptchaChallengeData;
  submitting: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CaptchaSubmitPayload];
}>();

const { t } = useI18n();
const code = ref("");
const solving = ref(false);
const localError = ref("");

const audioUrl = computed(() =>
  props.challenge.audio
    ? `/api/identity/auth/captcha/audio/${props.challenge.challenge_id}`
    : ""
);

async function submit() {
  const value = code.value.trim();
  if (!value || solving.value || props.submitting) return;
  localError.value = "";
  let powAnswer: { nonce: string } | undefined;
  if (props.challenge.pow) {
    solving.value = true;
    try {
      powAnswer = await solvePow(props.challenge.pow);
    } catch {
      localError.value = t("captchaChallenge.powFailed");
      return;
    } finally {
      solving.value = false;
    }
  }
  emit("submit", {
    answer: powAnswer
      ? { code: value, pow_answer: powAnswer }
      : { code: value },
    track: [],
    input: "keyboard"
  });
}

function reset() {
  code.value = "";
  localError.value = "";
}

function markSuccess() {
  code.value = "";
}

defineExpose({ reset, markSuccess });
</script>

<template>
  <div class="re-image-captcha">
    <p class="re-image-captcha__hint">{{ t("captchaChallenge.imageHint") }}</p>
    <img
      class="re-image-captcha__image"
      :src="challenge.background"
      :alt="t('captchaChallenge.imageAlt')"
      draggable="false"
    />
    <div class="re-image-captcha__row">
      <el-input
        v-model="code"
        :maxlength="challenge.length ?? undefined"
        :placeholder="t('captchaChallenge.imagePlaceholder')"
        autocomplete="off"
        data-testid="captcha-image-input"
        @keyup.enter="submit"
      />
      <el-button
        type="primary"
        :loading="submitting || solving"
        :disabled="!code.trim()"
        data-testid="captcha-image-submit"
        @click="submit"
      >
        {{ t("captchaChallenge.imageSubmit") }}
      </el-button>
    </div>
    <audio
      v-if="audioUrl"
      class="re-image-captcha__audio"
      controls
      preload="none"
      :src="audioUrl"
      :aria-label="t('captchaChallenge.imageAudio')"
    />
    <p v-if="challenge.pow" class="re-image-captcha__pow">
      {{
        solving
          ? t("captchaChallenge.powRunning")
          : t("captchaChallenge.imagePowHint")
      }}
    </p>
    <el-alert
      v-if="localError"
      class="mt-2!"
      type="error"
      :closable="false"
      show-icon
      :title="localError"
    />
  </div>
</template>

<style lang="scss" scoped>
.re-image-captcha {
  width: 100%;

  &__hint {
    margin-bottom: var(--space-2);
    font-size: var(--font-size-base);
    color: var(--el-text-color-regular);
  }

  &__image {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    user-select: none;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-sm);
  }

  &__row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-top: var(--space-3);
  }

  &__audio {
    width: 100%;
    margin-top: var(--space-2);
  }

  &__pow {
    margin-top: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--el-text-color-secondary);
  }
}
</style>
