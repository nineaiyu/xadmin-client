<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { useMutationObserver } from "@vueuse/core";

import type { ReScrollbarProps, ScrollArrivalState } from "./types";

defineOptions({ name: "ReScrollbar" });

/**
 * 增强滚动条：在 el-scrollbar 之上补「到达态」与「遮罩阴影」。
 *
 * - `scroll-at` 事件派发四向到达态（top/bottom/left/right），供「滚动到底加载更多」
 *   「新消息提示」等逻辑消费，省去各调用点重复手写 scrollTop/scrollHeight 判定；
 * - `shadow` 开启后，未到边界的一侧显示渐变遮罩，提示还有未展示内容；
 * - `scrollTo` / `setScrollTop` / `updateArrival` 经 defineExpose 暴露。
 */

/** 到达边界判定容差：scrollTop 为非整数而尺寸为整数 */
const ARRIVED_THRESHOLD = 1;
/** el-scrollbar 内部滚动代理节点（class 由 EP 渲染，非本组件定义） */
const WRAP_SELECTOR = [".el", "scrollbar__wrap"].join("-");

const props = withDefaults(defineProps<ReScrollbarProps>(), {
  height: undefined,
  maxHeight: undefined,
  native: false,
  shadow: true,
  always: false,
  label: undefined,
  keyboard: false
});

const emit = defineEmits<{ "scroll-at": [state: ScrollArrivalState] }>();

const rootRef = ref<HTMLElement>();
const wrapRef = ref<HTMLElement>();
const isAtTop = ref(true);
const isAtBottom = ref(true);

const containerStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.height !== undefined) style.height = toCssSize(props.height);
  if (props.maxHeight !== undefined)
    style.maxHeight = toCssSize(props.maxHeight);
  return style;
});

const showTopShadow = computed(() => props.shadow && !isAtTop.value);
const showBottomShadow = computed(() => props.shadow && !isAtBottom.value);

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

/** 读取当前滚动位置，同步到达态并派发 scroll-at */
function updateArrival(): void {
  const el = wrapRef.value;
  if (!el) return;
  isAtTop.value = el.scrollTop <= ARRIVED_THRESHOLD;
  isAtBottom.value =
    Math.abs(el.scrollTop) + el.clientHeight >=
    el.scrollHeight - ARRIVED_THRESHOLD;
  const isAtLeft = el.scrollLeft <= ARRIVED_THRESHOLD;
  const isAtRight =
    Math.abs(el.scrollLeft) + el.clientWidth >=
    el.scrollWidth - ARRIVED_THRESHOLD;
  emit("scroll-at", {
    top: isAtTop.value,
    bottom: isAtBottom.value,
    left: isAtLeft,
    right: isAtRight
  });
}

/**
 * 键盘可达：滚动容器可聚焦后可用方向键 / PageUp / PageDown 滚动内容。
 *
 * 默认不加 `tabindex`：页面里多个滚动容器会让 Tab 停靠点显著变多；
 * 仅在调用方显式要求键盘可达（`keyboard`）或提供了可访问名（`label`）时开启。
 */
function applyWrapA11y(): void {
  const wrap = wrapRef.value;
  if (!wrap) return;
  if (props.keyboard || props.label) {
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", "region");
  } else {
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("role");
  }
  if (props.label) {
    wrap.setAttribute("aria-label", props.label);
  } else {
    wrap.removeAttribute("aria-label");
  }
}

async function bindWrap(): Promise<void> {
  await nextTick();
  wrapRef.value =
    rootRef.value?.querySelector<HTMLElement>(WRAP_SELECTOR) ?? undefined;
  applyWrapA11y();
  wrapRef.value?.addEventListener("scroll", updateArrival, { passive: true });
  updateArrival();
}

watch(() => [props.label, props.keyboard], applyWrapA11y);
// native 切换（或 el-scrollbar 内部 DOM 重建）后重新绑定：仅 onMounted 绑一次时，
// 重建后的新 wrap 节点没有监听器，scroll-at 与阴影会静默停在上次状态。
// 当前 EP 版本两种模式都渲染 .el-scrollbar__wrap，此处兜底的是节点重建场景。
watch(
  () => props.native,
  async () => {
    unbindWrap();
    await bindWrap();
  }
);

function unbindWrap(): void {
  wrapRef.value?.removeEventListener("scroll", updateArrival);
  wrapRef.value = undefined;
}

/** 滚动到指定位置（原生 ScrollToOptions） */
function scrollTo(options: ScrollToOptions): void {
  wrapRef.value?.scrollTo(options);
}

/** 设置纵向滚动位置 */
function setScrollTop(top: number): void {
  wrapRef.value?.scrollTo({ top });
}

onMounted(bindWrap);
onBeforeUnmount(unbindWrap);

// 内容增长（消息追加 / 日志增量）不会触发 scroll：监听子节点变化后重算到达态，
// 否则「已到底」判定会一直停留在初始值
useMutationObserver(rootRef, () => updateArrival(), {
  childList: true,
  subtree: true,
  characterData: true
});

defineExpose({ scrollTo, setScrollTop, updateArrival });
</script>

<template>
  <div ref="rootRef" class="re-scrollbar">
    <el-scrollbar
      :native="native"
      :always="always"
      :style="containerStyle"
      :wrap-style="containerStyle"
    >
      <slot />
    </el-scrollbar>
    <div
      v-show="showTopShadow"
      class="re-scrollbar__mask re-scrollbar__mask--top"
    />
    <div
      v-show="showBottomShadow"
      class="re-scrollbar__mask re-scrollbar__mask--bottom"
    />
  </div>
</template>

<style lang="scss" scoped>
.re-scrollbar {
  position: relative;

  &__mask {
    position: absolute;
    left: 0;
    width: 100%;
    height: 24px;
    pointer-events: none;

    &--top {
      top: 0;
      background: linear-gradient(to bottom, hsl(var(--fg) / 8%), transparent);
    }

    &--bottom {
      bottom: 0;
      background: linear-gradient(to top, hsl(var(--fg) / 8%), transparent);
    }
  }
}
</style>
