<script lang="ts" setup>
import { ref } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import MenuIcon from "~icons/ep/menu";
import ChatMessageList from "@/components/ChatMessageList/index.vue";
import NewMessagesBadge from "@/components/NewMessagesBadge/index.vue";

/**
 * 消息流面板骨架（聊天室 ChatWindow / 助手页 AiChatPanel 共用）：
 * 头部（窄屏折叠按钮 + 标题/副标题 + 右侧动作）+ 消息区（ChatMessageList 壳，
 * 消息行与流式气泡经默认插槽渲染）+ 离底新消息悬浮条 + 底部输入区插槽。
 * 两条线的差异（行组件、流式气泡、输入工具条、空态与骨架口径）一律由调用方
 * 以 props/slots 注入，本组件不感知任何域模块。
 */
defineOptions({
  name: "MessageThreadPanel"
});

defineProps<{
  /** 头部标题与挂点（chat-room-title / ai-panel-title，E2E 以标题判定切换完成） */
  title: string;
  titleTestid: string;
  subtitle: string;
  /** 窄屏折叠按钮的可达名（会话列表 / 功能导航） */
  toggleLabel: string;
  isNarrow: boolean;
  /** 消息区滚动容器 testid（chat-messages / ai-messages） */
  listTestid: string;
  /** 历史骨架 testid（chat-history-skeleton / ai-history-skeleton） */
  skeletonTestid: string;
  /** 历史首屏加载且无行：骨架占位（与空态互斥，口径由调用方判定） */
  skeletonVisible: boolean;
  /** 显示「加载更早 / 没有更多」区（聊天室要求已选中会话） */
  historyBarVisible: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** 空态条件（各线口径不同，由调用方判定） */
  emptyVisible: boolean;
  emptyText: string;
  /** 离底期间的新消息计数（>0 显示悬浮条） */
  pendingCount: number;
}>();

const emit = defineEmits<{
  /** 窄屏折叠按钮：展开左侧导航抽屉 */
  toggle: [];
  scroll: [];
  loadMore: [];
  /** 滚动元素就绪（父级持有后用于滚动到底等操作） */
  ready: [HTMLElement | null];
  /** 新消息悬浮条点击：回到底部 */
  jumpToLatest: [];
}>();

/** 列表壳滚动元素：登记后供宿主组件 defineExpose 透出（保持既有对外形态） */
const scrollEl = ref<HTMLElement | null>(null);

function onListReady(element: HTMLElement | null) {
  scrollEl.value = element;
  emit("ready", element);
}

defineExpose({ scrollEl });
</script>

<template>
  <div class="relative flex h-full min-w-0 grow flex-col">
    <div
      class="flex items-center gap-2 border-0 border-b border-solid border-(--divider) px-3 py-2"
    >
      <el-button
        v-if="isNarrow"
        link
        :icon="useRenderIcon(MenuIcon)"
        :aria-label="toggleLabel"
        @click="emit('toggle')"
      />
      <div class="min-w-0 grow">
        <!-- 标题行：有行内扩展（图标/连接态）时才包 flex 行，保持两侧既有 DOM 形态 -->
        <div v-if="$slots['title-extras']" class="flex items-center gap-2">
          <span class="truncate font-medium" :data-testid="titleTestid">
            {{ title }}
          </span>
          <slot name="title-extras" />
        </div>
        <span v-else class="truncate font-medium" :data-testid="titleTestid">
          {{ title }}
        </span>
        <div class="truncate text-xs text-(--el-text-color-secondary)">
          {{ subtitle }}
        </div>
      </div>
      <slot name="actions" />
    </div>

    <ChatMessageList
      :testid="listTestid"
      :skeleton-testid="skeletonTestid"
      :skeleton-visible="skeletonVisible"
      :history-bar-visible="historyBarVisible"
      :has-more="hasMore"
      :loading-more="loadingMore"
      :empty-visible="emptyVisible"
      :empty-text="emptyText"
      @scroll="emit('scroll')"
      @load-more="emit('loadMore')"
      @ready="onListReady"
    >
      <slot />
    </ChatMessageList>

    <NewMessagesBadge :count="pendingCount" @jump="emit('jumpToLatest')" />

    <div class="border-0 border-t border-solid border-(--divider) p-3">
      <slot name="composer" />
    </div>
  </div>
</template>
