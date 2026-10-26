<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import type { CaptchaChallengeData, CaptchaTrackPoint } from "@/api/auth";
import type { CaptchaSubmitPayload } from "@/components/ReCaptchaChallenge/src/types";
import { toNaturalPoint } from "@/components/ReCaptchaChallenge/src/geometry";

defineOptions({ name: "ReWordClickCaptcha" });

const props = defineProps<{
  challenge: CaptchaChallengeData;
}>();

const emit = defineEmits<{
  submit: [payload: CaptchaSubmitPayload];
}>();

const { t } = useI18n();
const stageRef = ref<HTMLElement>();
const points = ref<{ x: number; y: number }[]>([]);
const track = ref<CaptchaTrackPoint[]>([]);
const verified = ref(false);
let startedAt = 0;

const naturalWidth = computed(() => props.challenge.width ?? 320);
const naturalHeight = computed(() => props.challenge.height ?? 180);
const total = computed(() => props.challenge.count ?? 3);
const complete = computed(() => points.value.length >= total.value);

const markers = computed(() =>
  points.value.map(point => ({
    left: `${(point.x / naturalWidth.value) * 100}%`,
    top: `${(point.y / naturalHeight.value) * 100}%`
  }))
);

function onStageClick(event: MouseEvent) {
  if (verified.value || points.value.length >= total.value) return;
  const rect = stageRef.value?.getBoundingClientRect();
  if (!rect) return;
  const point = toNaturalPoint(
    event.clientX,
    event.clientY,
    rect,
    naturalWidth.value,
    naturalHeight.value
  );
  if (!startedAt) startedAt = Date.now();
  points.value.push(point);
  track.value.push({ ...point, t: Date.now() - startedAt });
}

function resetSelection() {
  points.value = [];
  track.value = [];
  startedAt = 0;
}

function confirm() {
  if (!complete.value) return;
  emit("submit", {
    answer: { points: points.value.map(point => ({ ...point })) },
    track: [...track.value]
  });
}

function reset() {
  verified.value = false;
  resetSelection();
}

function markSuccess() {
  verified.value = true;
}

defineExpose({ reset, markSuccess });
</script>

<template>
  <div class="re-word-click">
    <p class="re-word-click__hint">{{ t("captchaChallenge.clickHint") }}</p>
    <div class="re-word-click__tip-row">
      <img
        v-if="challenge.tip"
        class="re-word-click__tip"
        :src="challenge.tip"
        :alt="t('captchaChallenge.tipAlt')"
        draggable="false"
      />
      <span class="re-word-click__count">
        {{ t("captchaChallenge.selected", { count: points.length, total }) }}
      </span>
    </div>
    <div
      ref="stageRef"
      class="re-word-click__stage"
      :style="{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }"
      role="button"
      tabindex="0"
      :aria-label="t('captchaChallenge.clickStage')"
      @click="onStageClick"
    >
      <img
        class="re-word-click__bg"
        :src="challenge.background"
        :alt="t('captchaChallenge.clickAlt')"
        draggable="false"
      />
      <span
        v-for="(marker, index) in markers"
        :key="index"
        class="re-word-click__marker"
        :style="marker"
      >
        {{ index + 1 }}
      </span>
    </div>
    <div class="re-word-click__actions">
      <el-button
        link
        type="primary"
        :disabled="points.length === 0"
        @click="resetSelection"
      >
        {{ t("captchaChallenge.resetSelection") }}
      </el-button>
      <el-button type="primary" :disabled="!complete" @click="confirm">
        {{ t("captchaChallenge.confirm") }}
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-word-click {
  width: 100%;

  &__hint {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-base);
    color: var(--el-text-color-regular);
  }

  &__tip-row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-2);
  }

  &__tip {
    height: 40px;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-sm);
  }

  &__count {
    font-size: var(--font-size-sm);
    color: var(--el-text-color-secondary);
  }

  &__stage {
    position: relative;
    width: 100%;
    overflow: hidden;
    cursor: crosshair;
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

  &__marker {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: var(--font-size-sm);
    color: var(--el-color-white);
    background: var(--el-color-primary);
    border: 1px solid var(--el-color-white);
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-2);
  }
}
</style>
