<script lang="ts" setup>
// 偏好选择卡组（vben 的预览卡形态）：选项即卡片，可选图标或 `preview` 插槽自绘缩略图；
// 选中态 = 主色描边 + 主色浅底 + 右上角勾选角标；原生 button 保证键盘可达
import type { PrefChoiceOption } from "./prefTypes";
import CheckIcon from "~icons/ep/select";

withDefaults(
  defineProps<{
    options: PrefChoiceOption[];
    modelValue: string;
    /** 卡片内容区最小高度（预览卡用，如 34px） */
    previewHeight?: number;
  }>(),
  { previewHeight: 0 }
);

const emit = defineEmits<{ change: [value: string] }>();
</script>

<template>
  <ul class="pref-choice">
    <li v-for="item in options" :key="item.value" class="pref-choice__cell">
      <button
        type="button"
        class="pref-choice__item"
        :class="{ 'is-active': item.value === modelValue }"
        :data-choice="item.value"
        :aria-pressed="item.value === modelValue"
        :disabled="item.disabled"
        :title="item.tip || item.label"
        @click="emit('change', item.value)"
      >
        <span
          v-if="item.icon"
          class="pref-choice__icon"
          :style="previewHeight ? { height: `${previewHeight}px` } : undefined"
        >
          <IconifyIconOffline :icon="item.icon" />
        </span>
        <span
          v-else-if="$slots.preview"
          class="pref-choice__preview"
          :style="previewHeight ? { height: `${previewHeight}px` } : undefined"
        >
          <slot name="preview" :value="item.value" />
        </span>
        <span class="pref-choice__label">{{ item.label }}</span>
        <IconifyIconOffline
          v-if="item.value === modelValue"
          :icon="CheckIcon"
          class="pref-choice__mark"
        />
      </button>
    </li>
  </ul>
</template>

<style lang="scss" scoped>
.pref-choice {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 8px;
}

.pref-choice__item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 6px;
  font: inherit;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);

  &:hover:not(:disabled) {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &.is-active {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }
}

.pref-choice__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
}

.pref-choice__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.pref-choice__label {
  font-size: var(--font-size-xs);
  line-height: 16px;
  white-space: nowrap;
}

.pref-choice__mark {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: var(--font-size-xs);
  color: var(--el-color-primary);
}
</style>
