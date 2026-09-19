<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import EmojiIcon from "~icons/ri/emotion-line";
import { DEFAULT_EMOJI_GROUP, EMOJI_GROUPS } from "./emojiGroups";

/**
 * 输入区表情面板：分类条 + 8 列网格，点击后经 `select` 由父组件在光标处插入。
 *
 * 面板内只有表情格子是 `<button>`、分类签用 `<span>`：页面 E2E 以 button 序号定位表情。
 */
const emit = defineEmits<{ select: [string] }>();

const { t } = useI18n();
const visible = ref(false);
const group = ref(DEFAULT_EMOJI_GROUP);
const items = computed(
  () => EMOJI_GROUPS.find(item => item.key === group.value)?.items ?? []
);
</script>

<template>
  <el-popover
    v-model:visible="visible"
    placement="top-start"
    :width="348"
    :show-arrow="false"
    :offset="12"
    trigger="click"
    popper-class="chat-emoji-popper"
  >
    <template #reference>
      <el-button
        link
        :aria-label="t('chat.emoji')"
        :title="t('chat.emoji')"
        data-testid="chat-emoji"
        :class="visible ? 'text-(--el-color-primary)' : ''"
        :icon="useRenderIcon(EmojiIcon)"
      />
    </template>
    <div class="chat-emoji-panel" data-testid="chat-emoji-panel">
      <div
        class="chat-emoji-panel__tabs"
        role="tablist"
        :aria-label="t('chat.emoji')"
      >
        <span
          v-for="item in EMOJI_GROUPS"
          :key="item.key"
          class="chat-emoji-panel__tab"
          :class="{ 'is-active': item.key === group }"
          role="tab"
          :aria-selected="item.key === group"
          :title="t(`chat.emojiGroups.${item.key}`)"
          @click="group = item.key"
        >
          {{ item.icon }}
        </span>
      </div>
      <!-- 切换分类时网格淡入淡出（out-in：旧组先退场，避免两组同帧顶开高度） -->
      <Transition name="chat-emoji-swap" mode="out-in">
        <div :key="group" class="chat-emoji-panel__grid">
          <button
            v-for="item in items"
            :key="item"
            type="button"
            class="chat-emoji-panel__item"
            @click="emit('select', item)"
          >
            {{ item }}
          </button>
        </div>
      </Transition>
    </div>
  </el-popover>
</template>

<style lang="scss">
/* 表情面板：el-popover 内容 teleport 到 body，组件 scoped 样式无法命中，
   因此用唯一的 popper-class 承载全局样式（类名互斥，不影响其他弹层）。
   颜色全部取自 EP 变量，明暗主题随站点自动适配 */
.el-popover.el-popper.chat-emoji-popper {
  padding: 12px;
  background:
    radial-gradient(
      120% 72% at 50% 0%,
      var(--el-color-primary-light-8) 0%,
      transparent 70%
    ),
    var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  box-shadow:
    0 16px 40px rgb(0 0 0 / 12%),
    0 4px 10px rgb(0 0 0 / 6%);
}

.chat-emoji-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform-origin: bottom left;
  animation: chat-emoji-panel-in 0.18s ease-out;

  &__tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--el-fill-color-light);
    border-radius: 11px;
  }

  &__tab {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 28px;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    border-radius: 8px;
    opacity: 0.7;
    transition:
      opacity 0.18s ease,
      background-color 0.18s ease;

    &:hover {
      background: var(--el-fill-color);
      opacity: 1;
    }

    &.is-active {
      background: var(--el-bg-color-overlay);
      box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
      opacity: 1;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 3px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 0;
    font-size: 21px;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    background: transparent;
    border: none;
    border-radius: 10px;
    opacity: 0.92;
    transition:
      transform 0.15s ease,
      background-color 0.15s ease,
      opacity 0.15s ease;

    &:hover {
      background: var(--el-fill-color);
      opacity: 1;
      transform: scale(1.12);
    }

    &:active {
      transform: scale(0.9);
    }
  }
}

@keyframes chat-emoji-panel-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 暗色下 --el-bg-color-overlay 比分类条底色更深，激活项会读成「凹陷」，
   改用 fill-color（暗色下比 fill-color-light 更亮）保持「浮起」的语义 */
html.dark {
  .chat-emoji-panel__tab.is-active {
    background: var(--el-fill-color);
    box-shadow: 0 1px 4px rgb(0 0 0 / 32%);
  }
}

/* 分类切换：退出略上移、进入自下方浮入，避免整块硬切 */
.chat-emoji-swap-enter-active,
.chat-emoji-swap-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.chat-emoji-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.chat-emoji-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
