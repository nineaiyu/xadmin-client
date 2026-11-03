<script lang="ts" setup>
/**
 * 大屏设计器空画布引导态（栅格 / 自由两板共用）：图形 + 主文案 + 最小操作提示。
 * 全部消费 --screen-* 令牌（投屏浅色档经 `.screen-root--light` 成对反转）；
 * 文字最浅取 --screen-fg-dim（55%）保深色画布对比度 ≥4.5:1，--screen-fg-faint（45%）
 * 只作装饰不承载文字。定位由外层负责（栅格板占整行 / 自由板绝对居中）。
 */
import { useI18n } from "vue-i18n";
import RankIcon from "~icons/ep/rank";

defineOptions({ name: "ScreenCanvasEmpty" });

const { t } = useI18n();
</script>

<template>
  <div class="canvas-empty" data-testid="canvas-empty">
    <el-icon class="canvas-empty__icon">
      <RankIcon />
    </el-icon>
    <p class="canvas-empty__title">{{ t("dataScreen.emptyCanvas") }}</p>
    <p class="canvas-empty__hint">{{ t("dataScreen.emptyCanvasHint") }}</p>
  </div>
</template>

<style lang="scss" scoped>
.canvas-empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;

  /* 不挡画布手势（点空白 = 取消选中 / 框选起点） */
  pointer-events: none;
  user-select: none;

  &__icon {
    font-size: var(--display-size-2xl);
    color: var(--screen-fg-dense);
  }

  &__title {
    font-size: var(--el-font-size-base);
    color: var(--screen-fg-muted);
  }

  &__hint {
    font-size: var(--el-font-size-small);
    color: var(--screen-fg-dim);
  }
}
</style>
