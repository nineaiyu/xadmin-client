<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReSliderCaptcha from "@/components/ReSliderCaptcha/src/index.vue";

import { isRotatePassing, randomRotate, rotateFromMove } from "./geometry";
import type { ReSliderRotateCaptchaProps } from "./types";

defineOptions({ name: "ReSliderRotateCaptcha" });

/**
 * 旋转验证码：底部滑条拖动时图片同步旋转，需把随机倾斜的图片转正才通过。
 * 复用 `ReSliderCaptcha`（`isSlot` 关闭自动通过，由本组件按角度判定）。
 */
const props = withDefaults(defineProps<ReSliderRotateCaptchaProps>(), {
  src: "",
  imageSize: 260,
  minDegree: 120,
  maxDegree: 300,
  diffDegree: 20,
  text: "",
  successText: ""
});

type SlideEvent = PointerEvent | KeyboardEvent;

const emit = defineEmits<{
  start: [event: PointerEvent];
  move: [payload: { event: SlideEvent; moveX: number }];
  end: [event: PointerEvent];
  success: [payload: { isPassing: boolean; time: string }];
}>();

interface SliderCaptchaExpose {
  resume: () => void;
}

const { t } = useI18n();

const verified = defineModel<boolean>({ default: false });

const slideRef = ref<SliderCaptchaExpose>();
const startTime = ref(0);
const targetDegree = ref(0);
const currentDegree = ref(0);

const stageStyle = computed(() => ({
  width: `${props.imageSize}px`,
  height: `${props.imageSize}px`
}));

const imageStyle = computed(() => ({
  transform: `rotate(${targetDegree.value - currentDegree.value}deg)`
}));

/** 图片加载完成即随机倾斜，作为本次待转正的目标角 */
function onImageLoad(): void {
  targetDegree.value = randomRotate(props.minDegree, props.maxDegree);
  currentDegree.value = 0;
}

function onStart(event: PointerEvent): void {
  startTime.value = Date.now();
  emit("start", event);
}

function onMove(payload: { event: SlideEvent; moveX: number }): void {
  currentDegree.value = rotateFromMove(
    payload.moveX,
    props.imageSize,
    props.maxDegree
  );
  emit("move", payload);
}

function onEnd(event: PointerEvent): void {
  emit("end", event);
  if (
    isRotatePassing(targetDegree.value, currentDegree.value, props.diffDegree)
  ) {
    verified.value = true;
    emit("success", {
      isPassing: true,
      time: ((Date.now() - startTime.value) / 1000).toFixed(1)
    });
    return;
  }
  currentDegree.value = 0;
  slideRef.value?.resume();
}
</script>

<template>
  <div class="re-slider-rotate-captcha">
    <div class="re-slider-rotate-captcha__stage" :style="stageStyle">
      <img
        v-if="src"
        :src="src"
        alt=""
        class="re-slider-rotate-captcha__img"
        :style="imageStyle"
        @load="onImageLoad"
      />
    </div>
    <ReSliderCaptcha
      ref="slideRef"
      v-model="verified"
      is-slot
      :text="text || t('sliderRotateCaptcha.text')"
      :success-text="successText || t('sliderCaptcha.successText')"
      @start="onStart"
      @move="onMove"
      @end="onEnd"
    />
  </div>
</template>

<style lang="scss" scoped>
.re-slider-rotate-captcha {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;

  &__stage {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: var(--radius-md);
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--duration-fast) linear;
  }
}
</style>
