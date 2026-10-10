<script lang="ts" setup>
// 设置面板行：左侧标签（可选副文案与帮助提示）+ 右侧控件插槽；
// 整行 hover 高亮、行间细分隔线；窄屏（面板全宽）自动改为上下堆叠
import { Z_INDEX } from "@/utils/zIndex";
import QuestionLine from "~icons/ri/question-line";

withDefaults(
  defineProps<{
    label?: string;
    tip?: string;
    /** 副文案：标签下方的小字说明（vben 的 sub 形态） */
    desc?: string;
    /** 强制上下堆叠（控件较宽时使用，窄屏由样式自动堆叠） */
    stack?: boolean;
    disabled?: boolean;
  }>(),
  { tip: "", desc: "", stack: false, disabled: false }
);
</script>

<template>
  <li
    class="pref-row"
    :class="{ 'pref-row--stack': stack, 'is-disabled': disabled }"
  >
    <span class="pref-row__label">
      <span class="pref-row__text">
        <slot>{{ label }}</slot>
        <el-tooltip
          v-if="tip"
          :content="tip"
          placement="top"
          :z-index="Z_INDEX.tippy"
        >
          <IconifyIconOffline :icon="QuestionLine" class="pref-row__tip" />
        </el-tooltip>
      </span>
      <span v-if="desc" class="pref-row__desc">{{ desc }}</span>
    </span>
    <span class="pref-row__control">
      <slot name="control" />
    </span>
  </li>
</template>

<style lang="scss" scoped>
.pref-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 6px;
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--ease-standard);

  /* 窄屏（面板 100% 宽）：标签在上、控件在下左对齐 */
  @media (width <= 768px) {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;

    &__control {
      align-self: stretch;
      justify-content: flex-start;
    }
  }

  & + & {
    border-top: 1px solid var(--el-border-color-extra-light);
  }

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.is-disabled {
    opacity: 0.55;
  }

  &__label {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__text {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: var(--font-size-base);
    line-height: 20px;
    color: var(--el-text-color-primary);
  }

  &__desc {
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
    color: var(--el-text-color-secondary);
  }

  &__tip {
    font-size: var(--font-size-md);
    color: var(--el-text-color-placeholder);
    cursor: help;
  }

  &__control {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }
}

.pref-row--stack {
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;

  .pref-row__control {
    align-self: stretch;
  }
}

/* 面板内的开关统一为紧凑尺寸（原各区块各自 :deep 覆写） */
:deep(.el-switch__core) {
  --el-switch-off-color: var(--switch-off);

  min-width: 36px;
  height: 18px;
}

:deep(.el-switch__core .el-switch__action) {
  height: 14px;
}
</style>
