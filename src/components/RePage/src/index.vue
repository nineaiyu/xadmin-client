<script lang="ts" setup>
import { computed, useSlots } from "vue";

defineOptions({ name: "RePage" });

/**
 * 通用页面骨架：可选页头（标题 + 描述 + 扩展区）+ 内容区 + 可选页脚。
 *
 * 供**非 `RePlusPage`** 页面（详情页、看板、分析页）统一版式。外层不额外加
 * 页面留白——页面留白由布局的 `.main-content`（`--content-gap`）统一提供，
 * 避免出现第二套留白口径。
 */
const props = withDefaults(
  defineProps<{
    /** 标题 */
    title?: string;
    /** 标题下的描述 */
    description?: string;
    /** 内容区自管滚动（适合高度受限的页面） */
    autoContentHeight?: boolean;
    /** 自动高度模式下的底部偏移（px），用于给固定页脚让位 */
    heightOffset?: number;
    /** 页脚吸附底部（否则紧随内容） */
    footerFixed?: boolean;
  }>(),
  {
    title: "",
    description: "",
    autoContentHeight: false,
    heightOffset: 0,
    footerFixed: false
  }
);

const slots = useSlots();

const hasHeader = computed(
  () =>
    !!props.title ||
    !!props.description ||
    !!slots.title ||
    !!slots.description ||
    !!slots.extra
);

const contentStyle = computed(() =>
  props.autoContentHeight ? { marginBottom: `${props.heightOffset}px` } : {}
);
</script>

<template>
  <div class="re-page">
    <div v-if="hasHeader" class="re-page__header">
      <div class="re-page__heading">
        <slot name="title">
          <div v-if="title" class="re-page__title">{{ title }}</div>
        </slot>
        <slot name="description">
          <p v-if="description" class="re-page__desc">{{ description }}</p>
        </slot>
      </div>
      <div v-if="$slots.extra" class="re-page__extra">
        <slot name="extra" />
      </div>
    </div>

    <div
      class="re-page__content"
      :class="{ 'is-auto': autoContentHeight }"
      :style="contentStyle"
    >
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="re-page__footer"
      :class="{ 'is-fixed': footerFixed }"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.re-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  &__header {
    /* 窄屏堆叠：标题/说明在上、操作区在下（横排会把操作区压成竖条） */
    @include bp.below("sm") {
      flex-direction: column;
      gap: var(--space-2);
      align-items: stretch;
    }

    display: flex;
    flex-shrink: 0;
    gap: var(--space-4);
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: var(--space-4);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid hsl(var(--border));
  }

  &__heading {
    min-width: 0;
  }

  &__title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: hsl(var(--fg));
  }

  &__desc {
    margin-top: var(--space-1);
    font-size: var(--font-size-sm);
    color: hsl(var(--fg-muted));
  }

  &__extra {
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    min-height: 0;

    &.is-auto {
      overflow-y: auto;
    }
  }

  &__footer {
    flex-shrink: 0;
    padding-top: var(--space-4);
    margin-top: var(--space-4);
    border-top: 1px solid hsl(var(--border));

    &.is-fixed {
      margin-top: auto;
    }
  }
}
</style>
