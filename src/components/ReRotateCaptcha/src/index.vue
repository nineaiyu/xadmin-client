<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useResizeObserver } from "@vueuse/core";

import ReSliderCaptcha from "@/components/ReSliderCaptcha";
import type { CaptchaChallengeData, CaptchaTrackPoint } from "@/api/auth";
import type { CaptchaSubmitPayload } from "@/components/ReCaptchaChallenge/src/types";
import {
  displayAngle,
  moveToAngle,
  sliderMax
} from "@/components/ReCaptchaChallenge/src/geometry";
import { isKeyboardEvent } from "@/utils/captchaSignal/track";

defineOptions({ name: "ReRotateCaptcha" });

defineProps<{
  challenge: CaptchaChallengeData;
  sliderText?: string;
  difficulty?: "easy" | "normal" | "hard";
}>();

const emit = defineEmits<{
  submit: [payload: CaptchaSubmitPayload];
}>();

const { t } = useI18n();
const sliderHostRef = ref<HTMLElement>();
const sliderRef = ref<InstanceType<typeof ReSliderCaptcha>>();
const sliderWidth = ref(0);
const moveX = ref(0);
const verified = ref(false);
const track = ref<CaptchaTrackPoint[]>([]);
let startedAt = 0;
let inputMode: "pointer" | "keyboard" = "pointer";

useResizeObserver(sliderHostRef, entries => {
  sliderWidth.value = entries[0]?.contentRect.width ?? 0;
});

const maxMove = computed(() => sliderMax(sliderWidth.value));
const angle = computed(() => moveToAngle(moveX.value, maxMove.value));
const imageStyle = computed(() => ({
  transform: `rotate(${displayAngle(angle.value)}deg)`
}));

function pushTrack(t: number) {
  track.value.push({ x: moveX.value, y: 0, t });
}

function onStart() {
  track.value = [];
  startedAt = Date.now();
  moveX.value = 0;
  inputMode = "pointer";
  pushTrack(0);
}

function onMove(payload: {
  event: PointerEvent | KeyboardEvent;
  moveX: number;
}) {
  if (isKeyboardEvent(payload.event)) inputMode = "keyboard";
  moveX.value = payload.moveX;
  if (!startedAt) startedAt = Date.now();
  pushTrack(Date.now() - startedAt);
}

function onEnd() {
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  if (track.value.length < 2) {
    pushTrack(Math.max(elapsed, 1));
  } else {
    track.value[track.value.length - 1].t = Math.max(
      elapsed,
      track.value.at(-1)?.t ?? 0
    );
  }
  emit("submit", {
    answer: { angle: angle.value },
    track: [...track.value],
    input: inputMode
  });
}

function reset() {
  verified.value = false;
  moveX.value = 0;
  track.value = [];
  startedAt = 0;
  sliderRef.value?.resume();
}

function markSuccess() {
  verified.value = true;
}

defineExpose({ reset, markSuccess });
</script>

<template>
  <div class="re-rotate-captcha" :data-difficulty="difficulty ?? 'normal'">
    <div class="re-rotate-captcha__stage">
      <img
        class="re-rotate-captcha__image"
        :src="challenge.background"
        :style="imageStyle"
        :alt="t('captchaChallenge.rotateAlt')"
        draggable="false"
      />
    </div>
    <div ref="sliderHostRef" class="mt-3">
      <ReSliderCaptcha
        ref="sliderRef"
        v-model="verified"
        is-slot
        :text="sliderText || t('sliderRotateCaptcha.text')"
        @start="onStart"
        @move="onMove"
        @end="onEnd"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-rotate-captcha {
  width: 100%;

  &__stage {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-sm);
  }

  &__image {
    width: 70%;
    height: auto;
    user-select: none;
    transition: transform 80ms linear;
  }
}
</style>
