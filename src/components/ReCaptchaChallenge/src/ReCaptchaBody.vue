<script lang="ts" setup>
import type { CaptchaChallengeData } from "@/api/auth";

import ReCaptchaPanel from "./Panel.vue";
import ReCaptchaPow from "./ReCaptchaPow.vue";
import type { CaptchaSubmitPayload } from "./types";

defineOptions({ name: "ReCaptchaBody" });

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
  solve: [];
}>();

defineExpose({
  reset: () => undefined
});
</script>

<template>
  <ReCaptchaPow
    v-if="challenge?.type === 'pow'"
    :challenge="challenge"
    :submitting="submitting"
    :error="error"
    :image-fallback="imageFallback"
    @solve="emit('solve')"
    @refresh="emit('refresh')"
    @fallback="emit('fallback')"
  />
  <ReCaptchaPanel
    v-else
    :challenge="challenge"
    :loading="loading"
    :submitting="submitting"
    :error="error"
    :success="success"
    :image-fallback="imageFallback"
    :shake="shake"
    @submit="emit('submit', $event)"
    @refresh="emit('refresh')"
    @fallback="emit('fallback')"
  />
</template>
