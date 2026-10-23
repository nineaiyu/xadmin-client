<script lang="ts" setup>
import { computed, useSlots } from "vue";
import { usePriorityValue } from "@/hooks/usePriorityValue";

defineOptions({ name: "RePage" });

/**
 * 通用页面骨架：可选页头（标题 + 描述 + 扩展区）+ 内容区 + 可选页脚。
 *
 * 供**非 `RePlusPage`** 页面（详情页、看板、分析页）统一版式。外层默认不额外
 * 加页面留白——页面留白由布局的 `.main-content`（`--content-gap`）统一提供，
 * 避免出现第二套留白口径；脱离布局挂载（抽屉 / 嵌入页）时再开 `padded`。
 *
 * 版式分区（自上而下）：页头 → 统计条（`#stats`）→ 工具栏（`#toolbar`）→
 * 内容区（默认 / `#empty`）→ 页脚。统计与工具栏区不参与内容滚动，
 * 间距由插槽内容自带，骨架不二次叠加外边距。
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
    /** 骨架自带内边距（脱离 layout 的 `.main-content` 时使用） */
    padded?: boolean;
    /** 空态：为 true 时以 `#empty` 插槽替代默认内容 */
    empty?: boolean;
  }>(),
  {
    title: "",
    description: "",
    autoContentHeight: false,
    heightOffset: 0,
    footerFixed: false,
    padded: false,
    empty: false
  }
);

const slots = useSlots();

/** 页头标题 / 描述：插槽优先、其次 props —— 与模板渲染同源，不重复判定 */
const title = usePriorityValue("title", props);
const description = usePriorityValue("description", props);

const hasHeader = computed(
  () => !!title.value || !!description.value || !!slots.extra
);

const contentStyle = computed(() =>
  props.autoContentHeight ? { marginBottom: `${props.heightOffset}px` } : {}
);
</script>

<template>
  <div class="re-page" :class="{ 'is-padded': padded }">
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

    <div v-if="$slots.stats" class="re-page__stats">
      <slot name="stats" />
    </div>

    <div v-if="$slots.toolbar" class="re-page__toolbar">
      <slot name="toolbar" />
    </div>

    <div
      class="re-page__content"
      :class="{ 'is-auto': autoContentHeight }"
      :style="contentStyle"
    >
      <slot v-if="!empty" />
      <slot v-else name="empty" />
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

  /* 脱离 layout 的 .main-content 时兜底留白；布局内保持 false，避免二次叠加 */
  &.is-padded {
    padding: var(--content-gap);
  }

  &__stats,
  &__toolbar {
    flex-shrink: 0;
  }

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
