<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { actionOffset } from "./geometry";

defineOptions({ name: "ReSliderCaptcha" });

/**
 * 滑块验证码：向右拖动滑块至末端即通过。
 *
 * 交互走 Pointer 事件（鼠标 / 触屏统一）。`isSlot=true` 时不自动判定通过，
 * 由外部监听 `success` 事件做服务端校验后再回写 `v-model`；`resume()` 用于
 * 校验失败后复位。
 */
const props = withDefaults(
  defineProps<{
    /** 提示文案（留空取内置文案） */
    text?: string;
    /** 通过后文案（留空取内置文案） */
    successText?: string;
    /** 拖到末端不自动通过，交由外部判定 */
    isSlot?: boolean;
    /** 滑块宽度（px） */
    actionWidth?: number;
  }>(),
  {
    text: "",
    successText: "",
    isSlot: false,
    actionWidth: 40
  }
);

/** 键盘操作与指针操作共用 move 载荷：`event` 取两种输入事件之一 */
type SlideEvent = PointerEvent | KeyboardEvent;

const emit = defineEmits<{
  start: [event: PointerEvent];
  move: [payload: { event: SlideEvent; moveX: number }];
  end: [event: PointerEvent];
  success: [payload: { isPassing: boolean; time: string }];
}>();

const { t } = useI18n();

const verified = defineModel<boolean>({ default: false });

const wrapperRef = ref<HTMLElement>();
const moveX = ref(0);
const isMoving = ref(false);
const isPassing = ref(verified.value);
const toLeft = ref(false);
let pointerOffset = 0;
let startTime = 0;

const offset = computed(() =>
  actionOffset(wrapperRef.value?.offsetWidth ?? 0, props.actionWidth)
);

const actionStyle = computed(() => ({
  left: `${moveX.value}px`,
  width: `${props.actionWidth}px`
}));

const barStyle = computed(() => {
  const full = wrapperRef.value?.offsetWidth ?? 0;
  const width = isPassing.value ? full : moveX.value + props.actionWidth / 2;
  return { width: `${width}px` };
});

/** 进度百分比（仅用于读屏播报，不参与视觉） */
const progressPercent = computed(() => {
  const max = offset.value;
  if (max <= 0) return 0;
  return Math.round((moveX.value / max) * 100);
});

const hintText = computed(() => {
  if (isPassing.value) {
    return props.successText || t("sliderCaptcha.successText");
  }
  return props.text || t("sliderCaptcha.text");
});

function onDown(event: PointerEvent) {
  if (isPassing.value || event.button !== 0) return;
  isMoving.value = true;
  pointerOffset = event.clientX - moveX.value;
  startTime = Date.now();
  emit("start", event);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onMove(event: PointerEvent) {
  if (!isMoving.value || isPassing.value) return;
  const max = offset.value;
  const next = Math.min(Math.max(event.clientX - pointerOffset, 0), max);
  moveX.value = next;
  emit("move", { event, moveX: next });
  if (!props.isSlot && max > 0 && next >= max) {
    checkPass();
  }
}

/**
 * 键盘操作（a11y）：滑块可聚焦，方向键步进（10% 轨道，最少 8px），
 * Home / End 直达两端；到末端与指针拖拽同口径判定通过。
 */
function onKeydown(event: KeyboardEvent) {
  if (isPassing.value) return;
  const max = offset.value;
  if (max <= 0) return;
  const step = Math.max(8, Math.round(max * 0.1));
  let next = moveX.value;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    next = Math.min(moveX.value + step, max);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    next = Math.max(moveX.value - step, 0);
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = max;
  } else {
    return;
  }
  event.preventDefault();
  if (!startTime) startTime = Date.now();
  moveX.value = next;
  emit("move", { event, moveX: next });
  if (!props.isSlot && next >= max) checkPass();
}

function onUp(event: PointerEvent) {
  if (!isMoving.value) return;
  emit("end", event);
  isMoving.value = false;
  detach();
  if (!isPassing.value) {
    resume();
  }
}

function checkPass() {
  isPassing.value = true;
  isMoving.value = false;
  verified.value = true;
  emit("success", {
    isPassing: true,
    time: ((Date.now() - startTime) / 1000).toFixed(1)
  });
}

/** 复位到起点（校验失败或需重试时调用） */
function resume() {
  toLeft.value = true;
  moveX.value = 0;
  setTimeout(() => {
    toLeft.value = false;
  }, 300);
}

function detach() {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
}

watch(verified, val => {
  if (val === isPassing.value) return;
  isPassing.value = val;
  if (!val) resume();
});

onBeforeUnmount(detach);

defineExpose({ resume });
</script>

<template>
  <div ref="wrapperRef" class="re-slider-captcha">
    <div
      class="re-slider-captcha__bar"
      :class="{ 'is-reset': toLeft }"
      :style="barStyle"
    />
    <span class="re-slider-captcha__text" :class="{ 'is-passing': isPassing }">
      {{ hintText }}
    </span>
    <div
      class="re-slider-captcha__action"
      :class="{ 'is-passing': isPassing, 'is-reset': toLeft }"
      :style="actionStyle"
      role="slider"
      tabindex="0"
      :aria-label="props.text || t('sliderCaptcha.text')"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progressPercent"
      :aria-disabled="isPassing || undefined"
      @pointerdown="onDown"
      @keydown="onKeydown"
    >
      <slot name="actionIcon" :is-passing="isPassing">
        <svg
          v-if="isPassing"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M3 8.5l3.2 3.2L13 5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M6 3.5L10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.re-slider-captcha {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  overflow: hidden;
  user-select: none;
  background: var(--el-fill-color-light);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);

  &__bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--el-color-success-light-7);

    &.is-reset {
      transition: width 0.3s;
    }
  }

  &__text {
    position: relative;
    font-size: var(--font-size-base);
    color: var(--el-text-color-secondary);

    &.is-passing {
      color: var(--el-color-success);
    }
  }

  &__action {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--el-color-primary);
    touch-action: none;
    cursor: grab;
    background: var(--el-bg-color);
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-sm);

    &.is-reset {
      transition: left 0.3s;
    }

    &.is-passing {
      color: var(--el-color-success);
      cursor: default;
    }
  }
}
</style>
