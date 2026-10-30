<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useResizeObserver } from "@vueuse/core";

import ReSliderCaptcha from "@/components/ReSliderCaptcha";
import type { CaptchaChallengeData, CaptchaTrackPoint } from "@/api/auth";
import type { CaptchaSubmitPayload } from "@/components/ReCaptchaChallenge/src/types";
import {
  buildTrackPoint,
  isKeyboardEvent,
  shouldSample
} from "@/utils/captchaSignal/track";
import {
  pieceGeometry,
  sliderMax
} from "@/components/ReCaptchaChallenge/src/geometry";

defineOptions({ name: "ReCaptchaPuzzle" });

const props = defineProps<{
  challenge: CaptchaChallengeData;
  sliderText?: string;
  difficulty?: "easy" | "normal" | "hard";
}>();

const emit = defineEmits<{
  submit: [payload: CaptchaSubmitPayload];
}>();

const { t } = useI18n();
const stageRef = ref<HTMLElement>();
const sliderHostRef = ref<HTMLElement>();
const sliderRef = ref<InstanceType<typeof ReSliderCaptcha>>();
const stageWidth = ref(0);
const sliderWidth = ref(0);
const displayX = ref(0);
const verified = ref(false);
const track = ref<CaptchaTrackPoint[]>([]);
let startedAt = 0;
let lastSampleAt = 0;
let inputMode: "pointer" | "keyboard" = "pointer";

useResizeObserver(stageRef, entries => {
  stageWidth.value = entries[0]?.contentRect.width ?? 0;
});
useResizeObserver(sliderHostRef, entries => {
  sliderWidth.value = entries[0]?.contentRect.width ?? 0;
});

const naturalWidth = computed(() => props.challenge.width ?? 320);
const naturalHeight = computed(() => props.challenge.height ?? 180);
const pieceSize = computed(() => props.challenge.piece_size ?? 56);
const scale = computed(() =>
  naturalWidth.value ? stageWidth.value / naturalWidth.value : 1
);
const maxMove = computed(() => sliderMax(sliderWidth.value));
// 视觉位移与提交答案同源：leftPx / scale === answerX
const geometry = computed(() =>
  pieceGeometry(
    displayX.value,
    maxMove.value,
    naturalWidth.value,
    pieceSize.value,
    stageWidth.value
  )
);

const pieceStyle = computed(() => ({
  // 后端返回的是整幅透明画布（拼块 x 已归零、保留真实 y）：
  // 必须按底图同宽叠加，否则整幅画布被缩到拼块尺寸，视觉上只剩一个小点
  width: `${naturalWidth.value * scale.value}px`,
  left: `${geometry.value.leftPx}px`
}));

function pushTrack(t: number, ev?: string) {
  track.value.push(buildTrackPoint(displayX.value, 0, t, ev));
}

function onStart() {
  track.value = [];
  startedAt = Date.now();
  displayX.value = 0;
  inputMode = "pointer";
  lastSampleAt = 0;
  pushTrack(0, "down");
}

function onMove(payload: {
  event: PointerEvent | KeyboardEvent;
  moveX: number;
}) {
  if (isKeyboardEvent(payload.event)) {
    inputMode = "keyboard";
  }
  displayX.value = payload.moveX;
  if (!startedAt) startedAt = Date.now();
  const now = Date.now();
  if (inputMode === "keyboard" || shouldSample(now, lastSampleAt)) {
    lastSampleAt = now;
    pushTrack(now - startedAt, inputMode === "keyboard" ? "keyboard" : "move");
  }
}

function onEnd() {
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  if (track.value.length < 2) {
    pushTrack(Math.max(elapsed, 1), "up");
  } else {
    track.value[track.value.length - 1].t = Math.max(
      elapsed,
      track.value.at(-1)?.t ?? 0
    );
  }
  emit("submit", {
    answer: { x: Math.round(geometry.value.answerX) },
    track: [...track.value],
    input: inputMode
  });
}

function reset() {
  verified.value = false;
  displayX.value = 0;
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
  <div class="re-captcha-puzzle" :data-difficulty="difficulty ?? 'normal'">
    <div
      ref="stageRef"
      class="re-captcha-puzzle__stage"
      :style="{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }"
    >
      <img
        class="re-captcha-puzzle__bg"
        :src="challenge.background"
        :alt="t('captchaChallenge.puzzleAlt')"
        draggable="false"
      />
      <img
        v-show="stageWidth > 0"
        class="re-captcha-puzzle__piece"
        :src="challenge.piece"
        :style="pieceStyle"
        alt=""
        draggable="false"
      />
    </div>
    <div ref="sliderHostRef" class="mt-3">
      <ReSliderCaptcha
        ref="sliderRef"
        v-model="verified"
        is-slot
        :text="sliderText || t('sliderTranslateCaptcha.text')"
        @start="onStart"
        @move="onMove"
        @end="onEnd"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-captcha-puzzle {
  width: 100%;

  &__stage {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-sm);
  }

  &__bg {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }

  &__piece {
    position: absolute;
    top: 0;
    height: auto;
    pointer-events: none;
    user-select: none;
  }
}
</style>
