<script lang="ts" setup>
// 键位录制控件：点击进入录制态 → 按一次组合键写入；Esc 取消、Backspace/Delete 清空。
// 浏览器保留键与冲突键由校验拒绝并提示（保留键口径见 utils/shortcutKeys）。
import { computed, nextTick, ref } from "vue";
import { message } from "@/utils/message";
import { useNav } from "@/layout/hooks/useNav";
import {
  eventToShortcut,
  formatShortcut,
  isReservedShortcut,
  parseShortcut
} from "@/utils/shortcutKeys";

import CloseIcon from "~icons/ep/close";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    disabled?: boolean;
    /** 保存前校验：返回错误文案则拒绝写入（冲突检测由调用方承担） */
    validate?: (_value: string) => string | null;
  }>(),
  { modelValue: "", disabled: false, validate: () => null }
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { t } = useNav();
const recording = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);

const display = computed(
  () => formatShortcut(props.modelValue) || t("layout.shortcutUnset")
);

function startRecording() {
  if (props.disabled) return;
  recording.value = true;
  // 焦点落到触发按钮：录制期间按键在控件内被截获（stopPropagation 阻断全局快捷键）
  nextTick(() => triggerRef.value?.focus());
}

function clearShortcut() {
  emit("update:modelValue", "");
}

function onKeydown(event: KeyboardEvent) {
  if (!recording.value) return;
  // 录制态独占键盘：阻止浏览器默认行为与 window 级全局快捷键（冒泡末端监听）
  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    recording.value = false;
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    recording.value = false;
    clearShortcut();
    return;
  }

  const value = eventToShortcut(event);
  if (!value) return; // 仅按修饰键 / 无修饰键：保持录制态，等待完整组合
  if (isReservedShortcut(parseShortcut(value))) {
    message(t("layout.shortcutReserved"), { type: "warning" });
    return;
  }
  const error = props.validate?.(value);
  if (error) {
    message(error, { type: "warning" });
    return;
  }
  recording.value = false;
  emit("update:modelValue", value);
}
</script>

<template>
  <span class="shortcut-input">
    <button
      ref="triggerRef"
      type="button"
      class="shortcut-input__trigger"
      :class="{ 'is-recording': recording }"
      :disabled="disabled"
      :aria-label="t('layout.shortcutRecord')"
      @click="startRecording"
      @keydown="onKeydown"
      @blur="recording = false"
    >
      <span v-if="recording" class="shortcut-input__hint">
        {{ t("layout.shortcutRecording") }}
      </span>
      <span
        v-else
        class="shortcut-input__keys"
        :class="{ 'is-empty': !modelValue }"
      >
        {{ display }}
      </span>
    </button>
    <button
      v-if="modelValue && !disabled && !recording"
      type="button"
      class="shortcut-input__clear"
      :aria-label="t('layout.shortcutClear')"
      @click="clearShortcut"
    >
      <IconifyIconOffline :icon="CloseIcon" />
    </button>
  </span>
</template>

<style lang="scss" scoped>
.shortcut-input {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.shortcut-input__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 104px;
  height: 26px;
  padding: 0 10px;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--el-text-color-primary);
  cursor: pointer;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-sm);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary-light-5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-recording {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }
}

.shortcut-input__keys.is-empty {
  font-family: var(--font-family-base);
  color: var(--el-text-color-placeholder);
}

.shortcut-input__hint {
  font-family: var(--font-family-base);
  font-size: var(--font-size-xs);
}

.shortcut-input__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-full);
  transition: color var(--duration-fast) var(--ease-standard);

  &:hover {
    color: var(--el-color-danger);
  }
}
</style>
