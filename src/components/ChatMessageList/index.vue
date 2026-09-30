<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import ReEmpty from "@/components/ReEmpty";
import ReSkeleton from "@/components/ReSkeleton";

/**
 * 消息列表壳（聊天室 / 助手页共用）：滚动容器 + 历史骨架 + 「加载更早」条 +
 * 空态；消息行与流式气泡经默认插槽渲染（两条线的行组件与数据层不同，
 * 空态条件与骨架口径也各由调用方判定后传入）。滚动元素经 `ready` 事件
 * 回传，父级滚动到底 / 定位逻辑保持原口径。
 */
defineOptions({
  name: "ChatMessageList"
});

defineProps<{
  /** 滚动容器 testid（chat-messages / ai-messages） */
  testid: string;
  /** 骨架 testid（chat-history-skeleton / ai-history-skeleton） */
  skeletonTestid: string;
  /** 历史首屏加载且无行：骨架占位（与空态互斥） */
  skeletonVisible: boolean;
  /** 显示「加载更早 / 没有更多」区（聊天室要求已选中会话） */
  historyBarVisible: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** 空态条件（各线口径不同，由调用方判定） */
  emptyVisible: boolean;
  /** 空态文案 */
  emptyText: string;
}>();

const emit = defineEmits<{
  scroll: [];
  loadMore: [];
  /** 滚动元素就绪（父级持有后用于滚动到底等操作） */
  ready: [HTMLElement | null];
}>();

const { t } = useI18n();
const scrollEl = ref<HTMLElement | null>(null);

onMounted(() => emit("ready", scrollEl.value));
</script>

<template>
  <div
    ref="scrollEl"
    class="grow overflow-y-auto px-2 py-3"
    :data-testid="testid"
    @scroll.passive="emit('scroll')"
  >
    <!-- 历史首屏加载：骨架气泡占位（切换会话时消息已清空，加载态与空态互斥） -->
    <div
      v-if="skeletonVisible"
      class="flex flex-col gap-3 py-2"
      :data-testid="skeletonTestid"
    >
      <ReSkeleton
        v-for="row in 4"
        :key="row"
        variant="fill"
        class="h-12!"
        :class="row % 2 ? 'w-2/3! self-start' : 'w-1/2! self-end'"
      />
    </div>

    <!-- 仅在有历史消息时显示「加载更早 / 没有更多」：空会话由中部空态统一表达，
         否则顶部「没有更多历史消息」与中部「还没有消息」同时出现、文案矛盾 -->
    <div
      v-if="historyBarVisible"
      class="mb-2 text-center text-xs text-(--el-text-color-secondary)"
    >
      <el-button
        v-if="hasMore"
        link
        size="small"
        :loading="loadingMore"
        @click="emit('loadMore')"
      >
        {{ t("chat.loadMore") }}
      </el-button>
      <span v-else>{{ t("chat.noMoreHistory") }}</span>
    </div>

    <slot />

    <ReEmpty v-if="emptyVisible" :description="emptyText" />
  </div>
</template>
