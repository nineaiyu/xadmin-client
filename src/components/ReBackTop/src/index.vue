<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { LAYOUT_SCROLL_SELECTOR } from "@/utils/dom";

import type { ReBackTopProps } from "./types";

defineOptions({ name: "ReBackTop" });

/**
 * 回到顶部：默认目标为本项目布局内容区滚动容器（`lay-content` 的 el-scrollbar
 * 代理节点），省去各处重复填写 target；用原生 `<button>` 实现（可聚焦、Enter /
 * Space 原生触发点击），可访问名取 `title` 或内置文案。
 *
 * 滚动行为与 el-backtop 对齐（默认平滑），可用 `behavior` 覆盖。
 *
 * 不封装 el-backtop 的原因：其渲染为多根（过渡包裹）导致 `role` / `tabindex` /
 * `aria-label` 等 attrs 无法透传，键盘不可达。
 */
const props = withDefaults(defineProps<ReBackTopProps>(), {
  target: "",
  visibilityHeight: 200,
  right: 24,
  bottom: 24,
  title: "",
  behavior: "smooth"
});

const { t } = useI18n();

const finalTarget = computed(() => props.target || LAYOUT_SCROLL_SELECTOR);
const label = computed(() => props.title || t("backTop.text"));
const buttonStyle = computed(() => ({
  right: `${props.right}px`,
  bottom: `${props.bottom}px`
}));

const visible = ref(false);
let scrollEl: HTMLElement | null = null;

function onScroll(): void {
  visible.value = (scrollEl?.scrollTop ?? 0) >= props.visibilityHeight;
}

onMounted(() => {
  scrollEl = document.querySelector<HTMLElement>(finalTarget.value);
  scrollEl?.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
});

onBeforeUnmount(() => {
  scrollEl?.removeEventListener("scroll", onScroll);
});

function scrollToTop(): void {
  const el = scrollEl;
  if (!el) return;
  // 显式传 behavior 会压过 CSS 的 scroll-behavior；系统开启「减弱动态效果」时退回瞬时，
  // 与 style/transition.scss 的全局退让口径一致
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  el.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : props.behavior });
}
</script>

<template>
  <Transition name="re-backtop-fade">
    <button
      v-show="visible"
      type="button"
      class="re-backtop"
      :style="buttonStyle"
      :title="label"
      :aria-label="label"
      @click="scrollToTop"
    >
      <slot>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M8 13V4M4 7.5L8 3.5l4 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </slot>
    </button>
  </Transition>
</template>

<style lang="scss" scoped>
.re-backtop {
  position: fixed;
  z-index: var(--z-index-layout);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background-color: var(--el-bg-color-overlay);
  border: none;
  border-radius: 50%;
  box-shadow: var(--el-box-shadow-lighter);
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);

  &:hover {
    color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }
}

.re-backtop-fade-enter-active,
.re-backtop-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.re-backtop-fade-enter-from,
.re-backtop-fade-leave-to {
  opacity: 0;
}
</style>
