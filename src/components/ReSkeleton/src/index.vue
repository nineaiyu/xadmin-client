<script lang="ts" setup>
import { computed } from "vue";

/**
 * 轻量骨架屏：脉冲占位块（无第三方依赖，颜色走 EP 令牌、暗色自动适配）。
 *
 * - `variant="text"`：按 `rows` 渲染文本行（宽度递减，模拟段落）；
 * - `variant="fill"`：单块撑满容器（模拟图表 / 图片 / 大数字）。
 *
 * 用于「容器尺寸稳定」的加载态（如看板卡片）；列表页首屏保持既有
 * 占位策略（RePlusPage 的搜索卡片高度占位 + 列首帧隐藏），避免破坏 CLS 收口。
 */
defineOptions({ name: "ReSkeleton" });

const props = withDefaults(
  defineProps<{
    variant?: "text" | "fill";
    /** text 变体的行数（1–6，超出按 6 计） */
    rows?: number;
    /** 是否播放脉冲动画（视觉回归截图用 stabilize 全局禁用动画，不受影响） */
    animated?: boolean;
  }>(),
  { variant: "text", rows: 3, animated: true }
);

const rowList = computed(() => {
  const count = Math.min(Math.max(props.rows, 1), 6);
  return Array.from({ length: count }, (_, index) => index);
});

/** 文本行宽度递减（末行更短，近似段落观感） */
const rowWidth = (index: number, total: number) => {
  if (index === total - 1 && total > 1) return "62%";
  return `${100 - index * 8}%`;
};
</script>

<template>
  <div
    class="re-skeleton"
    :class="{ 're-skeleton--animated': animated }"
    aria-hidden="true"
  >
    <template v-if="variant === 'fill'">
      <span class="re-skeleton__fill" />
    </template>
    <template v-else>
      <span
        v-for="index in rowList"
        :key="index"
        class="re-skeleton__line"
        :style="{ width: rowWidth(index, rowList.length) }"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.re-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;

  &--animated .re-skeleton__line,
  &--animated .re-skeleton__fill {
    animation: re-skeleton-pulse 1.4s ease-in-out infinite;
  }
}

.re-skeleton__line {
  height: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

.re-skeleton__fill {
  flex: 1;
  min-height: 48px;
  background: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

@keyframes re-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}
</style>
