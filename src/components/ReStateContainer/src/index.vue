<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import ReEmpty from "@/components/ReEmpty";
import ReSkeleton from "@/components/ReSkeleton";

defineOptions({ name: "ReStateContainer" });

/**
 * 状态容器：把 loading / empty / error / ready 四态收敛为一处渲染，
 * 统一消费既有 `ReSkeleton` / `ReEmpty` / `el-alert`，不新造视觉。
 *
 * 各态均可经同名插槽整体替换；`ready` 走默认插槽。`minHeight` 用于多态切换时
 * 保持占位高度，避免内容跳动（CLS）。
 */
const props = withDefaults(
  defineProps<{
    /** 当前状态 */
    state?: "loading" | "empty" | "error" | "ready";
    /** 加载态形态：骨架屏（默认）或转圈 */
    loadingVariant?: "skeleton" | "spinner";
    /** 加载态文案（仅 spinner 形态展示） */
    loadingText?: string;
    /** 加载态骨架行数（1–6） */
    skeletonRows?: number;
    /** 加载态骨架为整块填充（模拟图表 / 图片） */
    skeletonFill?: boolean;
    /** 空态文案 */
    emptyHint?: string;
    /** 空态图标（离线图标集可用名） */
    emptyIcon?: string;
    /** 错误态标题 */
    errorText?: string;
    /** 错误态描述 */
    errorDetail?: string;
    /** 最小高度（px）——多态切换时保持占位，避免跳动 */
    minHeight?: number;
  }>(),
  {
    state: "ready",
    loadingVariant: "skeleton",
    loadingText: "",
    skeletonRows: 3,
    skeletonFill: false,
    emptyHint: "",
    emptyIcon: "ep/box",
    errorText: "",
    errorDetail: "",
    minHeight: 0
  }
);

const { t } = useI18n();

const rootStyle = computed(() =>
  props.minHeight ? { minHeight: `${props.minHeight}px` } : undefined
);

const emptyText = computed(() => props.emptyHint || t("reState.empty"));
const errorTitle = computed(() => props.errorText || t("reState.error"));
</script>

<template>
  <div
    class="re-state-container"
    :style="rootStyle"
    :aria-busy="state === 'loading' || undefined"
  >
    <template v-if="state === 'loading'">
      <slot name="loading">
        <ReSkeleton
          v-if="loadingVariant === 'skeleton'"
          :variant="skeletonFill ? 'fill' : 'text'"
          :rows="skeletonRows"
        />
        <div v-else class="re-state-container__spinner" role="status">
          <span class="re-state-container__spin" aria-hidden="true" />
          <span v-if="loadingText" class="re-state-container__text">
            {{ loadingText }}
          </span>
        </div>
      </slot>
    </template>

    <template v-else-if="state === 'empty'">
      <slot name="empty">
        <ReEmpty :description="emptyText" :icon="emptyIcon" />
      </slot>
    </template>

    <template v-else-if="state === 'error'">
      <slot name="error">
        <el-alert
          type="error"
          :closable="false"
          show-icon
          :title="errorTitle"
          :description="errorDetail"
        />
      </slot>
    </template>

    <slot v-else />
  </div>
</template>

<style lang="scss" scoped>
.re-state-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;

  &__spinner {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: center;
    justify-content: center;
    padding: var(--space-6) 0;
  }

  &__spin {
    width: 22px;
    height: 22px;
    border: 2px solid var(--el-border-color-lighter);
    border-top-color: var(--el-color-primary);
    border-radius: var(--radius-full);
    animation: re-state-spin 0.8s linear infinite;
  }

  &__text {
    font-size: var(--font-size-base);
    color: var(--el-text-color-secondary);
  }
}

@keyframes re-state-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
