<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReSliderCaptcha from "@/components/ReSliderCaptcha/src/index.vue";
import { actionOffset } from "@/components/ReSliderCaptcha/src/geometry";

import {
  isTranslatePassing,
  pieceLeftFromMove,
  randomOffset
} from "./geometry";
import type { ReSliderTranslateCaptchaProps } from "./types";

defineOptions({ name: "ReSliderTranslateCaptcha" });

/**
 * 拼图验证码：拖动滑条使拼图块横向移动，对齐缺口即通过。
 * 复用 `ReSliderCaptcha`（`isSlot` 关闭自动通过，由本组件按位移容差判定）。
 */
const props = withDefaults(defineProps<ReSliderTranslateCaptchaProps>(), {
  src: "",
  imageSize: 260,
  pieceSize: 48,
  diffX: 8,
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

/** 与 ReSliderCaptcha 的滑块宽度保持一致（其 actionWidth 缺省值） */
const ACTION_WIDTH = 40;

const { t } = useI18n();

const verified = defineModel<boolean>({ default: false });

const trackRef = ref<HTMLElement>();
const slideRef = ref<SliderCaptchaExpose>();
const startTime = ref(0);
const targetLeft = ref(0);
const pieceTop = ref(0);
const currentLeft = ref(0);

/** 滑条可移动行程（用于把位移等比映射到拼图区间） */
const trackMax = computed(() =>
  actionOffset(trackRef.value?.offsetWidth ?? 0, ACTION_WIDTH)
);

const stageStyle = computed(() => ({
  width: `${props.imageSize}px`,
  height: `${props.imageSize}px`
}));

const bgStyle = computed(() => ({
  backgroundImage: props.src ? `url(${props.src})` : undefined,
  backgroundSize: `${props.imageSize}px ${props.imageSize}px`
}));

function pieceStyle(left: number, withImage: boolean) {
  return {
    width: `${props.pieceSize}px`,
    height: `${props.pieceSize}px`,
    left: `${left}px`,
    top: `${pieceTop.value}px`,
    ...(withImage
      ? {
          backgroundImage: props.src ? `url(${props.src})` : undefined,
          backgroundSize: `${props.imageSize}px ${props.imageSize}px`,
          backgroundPosition: `-${left}px -${pieceTop.value}px`
        }
      : {})
  };
}

/** 初始化随机缺口位置（挂载即定：几何只取决于 imageSize / pieceSize，与图片加载无关） */
function resetPositions(): void {
  targetLeft.value = randomOffset(props.imageSize, props.pieceSize);
  pieceTop.value = randomOffset(props.imageSize, props.pieceSize);
  currentLeft.value = 0;
}

onMounted(resetPositions);

function onStart(event: PointerEvent): void {
  startTime.value = Date.now();
  emit("start", event);
}

function onMove(payload: { event: SlideEvent; moveX: number }): void {
  currentLeft.value = pieceLeftFromMove(
    payload.moveX,
    trackMax.value,
    props.imageSize,
    props.pieceSize
  );
  emit("move", payload);
}

function onEnd(event: PointerEvent): void {
  emit("end", event);
  if (isTranslatePassing(targetLeft.value, currentLeft.value, props.diffX)) {
    verified.value = true;
    emit("success", {
      isPassing: true,
      time: ((Date.now() - startTime.value) / 1000).toFixed(1)
    });
    return;
  }
  currentLeft.value = 0;
  slideRef.value?.resume();
}
</script>

<template>
  <div class="re-slider-translate-captcha">
    <div class="re-slider-translate-captcha__stage" :style="stageStyle">
      <div class="re-slider-translate-captcha__bg" :style="bgStyle" />
      <div
        class="re-slider-translate-captcha__hole"
        :style="pieceStyle(targetLeft, false)"
      />
      <div
        v-if="src && targetLeft >= 0"
        class="re-slider-translate-captcha__piece"
        :style="pieceStyle(currentLeft, true)"
      />
    </div>
    <div ref="trackRef">
      <ReSliderCaptcha
        ref="slideRef"
        v-model="verified"
        is-slot
        :text="text || t('sliderTranslateCaptcha.text')"
        :success-text="successText || t('sliderCaptcha.successText')"
        @start="onStart"
        @move="onMove"
        @end="onEnd"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-slider-translate-captcha {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;

  &__stage {
    position: relative;
    margin: 0 auto;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: var(--radius-md);
  }

  &__bg {
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
  }

  &__hole,
  &__piece {
    position: absolute;
    border-radius: var(--radius-xs);
  }

  &__hole {
    background: hsl(var(--fg) / 55%);
    box-shadow: inset 0 0 4px hsl(var(--fg) / 45%);
  }

  &__piece {
    background-repeat: no-repeat;
    border: 1px solid hsl(var(--border-light));
    box-shadow: var(--shadow-sm);
  }
}
</style>
