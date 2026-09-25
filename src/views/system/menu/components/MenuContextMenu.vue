<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from "vue";
import type { MenuNodeAction } from "../utils/types";

/**
 * 树行右键菜单：与行内「更多」下拉共用同一份动作清单（buildNodeActions）。
 *
 * 自绘而非 el-dropdown：需要按鼠标位置定位（el-dropdown 触发器为固定元素），
 * 并做视口边界收敛，避免贴边时菜单出屏。
 */

const props = withDefaults(
  defineProps<{
    visible: boolean;
    x?: number;
    y?: number;
    title?: string;
    actions?: MenuNodeAction[];
  }>(),
  { x: 0, y: 0, title: "", actions: () => [] }
);

const emit = defineEmits<{ select: [code: string]; close: [] }>();

const MENU_WIDTH = 210;
const ITEM_HEIGHT = 30;

const style = computed(() => {
  const height = props.actions.length * ITEM_HEIGHT + 40;
  const left = Math.min(props.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(props.y, window.innerHeight - height - 8);
  return {
    left: `${Math.max(4, left)}px`,
    top: `${Math.max(4, top)}px`
  };
});

const close = () => emit("close");

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

onMounted(() => {
  document.addEventListener("click", close);
  window.addEventListener("scroll", close, true);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  document.removeEventListener("click", close);
  window.removeEventListener("scroll", close, true);
  window.removeEventListener("keydown", onKeydown);
});

const onSelect = (action: MenuNodeAction) => {
  if (action.disabled) return;
  action.run();
  close();
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="menu-context"
      :style="style"
      role="menu"
      @click.stop
      @contextmenu.prevent
    >
      <div v-if="title" class="menu-context__title">{{ title }}</div>
      <button
        v-for="item in actions"
        :key="item.code"
        :disabled="item.disabled"
        :class="{
          'is-danger': item.danger,
          'is-divided': item.divided
        }"
        class="menu-context__item"
        role="menuitem"
        type="button"
        @click="onSelect(item)"
      >
        <el-icon v-if="item.icon" class="menu-context__icon">
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.menu-context {
  position: fixed;
  z-index: 3000;
  width: 210px;
  padding: 4px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);

  &__title {
    padding: 4px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-regular);
    white-space: nowrap;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__item {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    height: 30px;
    padding: 0 10px;
    font-size: var(--el-font-size-small);
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: transparent;
    border: none;
    border-radius: var(--el-border-radius-base);

    &:hover:not(:disabled) {
      color: var(--el-color-primary);
      background: var(--el-fill-color-light);
    }

    &:disabled {
      color: var(--el-text-color-placeholder);
      cursor: not-allowed;
    }

    &.is-danger:hover:not(:disabled) {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
    }

    &.is-divided {
      margin-top: 4px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }

  &__icon {
    font-size: var(--el-font-size-base);
  }
}
</style>
