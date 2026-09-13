<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import MenuIcon from "~icons/ep/menu";
import SendIcon from "~icons/ep/promotion";
import AiIcon from "~icons/ep/cpu";
import type { ChatMessageItem, ChatPeer, ChatRoomItem } from "@/api/chat";
import MessageBubble from "./MessageBubble.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条）+ 输入区。
 *
 * 输入区约定：Enter 发送、Shift+Enter 换行；`@` 触发在线成员联想；
 * AI 会话支持 `/kb 问题` 走知识库问答。
 */
const props = defineProps<{
  room: ChatRoomItem | null;
  groups: Array<
    | { type: "divider"; key: string; label: string }
    | { type: "message"; key: string; item: ChatMessageItem }
  >;
  mine: (_item: ChatMessageItem) => boolean;
  contacts: ChatPeer[];
  aiEnabled: boolean;
  aiHint: string;
  aiCommand: string;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  thinking: boolean;
  connected: boolean;
  pendingCount: number;
  isNarrow: boolean;
}>();

const emit = defineEmits<{
  send: [string];
  recall: [ChatMessageItem];
  resend: [ChatMessageItem];
  loadMore: [];
  scroll: [];
  scrollToBottom: [];
  scroller: [HTMLElement | null];
  toggleSidebar: [];
}>();

const { t } = useI18n();
const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);

onMounted(() => emit("scroller", scrollEl.value));

const isAiRoom = computed(() => props.room?.room_type === "ai");
const isPublicRoom = computed(() => props.room?.room_type === "public");
const onlineCount = computed(
  () => props.contacts.filter(item => item.online).length
);

const title = computed(() => {
  if (!props.room) return t("chat.selectRoom");
  if (isAiRoom.value) return t("chat.aiAssistant");
  if (isPublicRoom.value) return t("chat.publicRoom");
  return (
    props.room.peer?.nickname ||
    props.room.peer?.username ||
    t("chat.unknownUser")
  );
});

const subtitle = computed(() => {
  if (!props.room) return "";
  if (isAiRoom.value) return props.aiHint || t("chat.aiRoomHint");
  if (isPublicRoom.value)
    return t("chat.onlineCount", { count: onlineCount.value });
  return props.room.peer?.online ? t("chat.online") : t("chat.offline");
});

const placeholder = computed(() => {
  if (isAiRoom.value) {
    return t("chat.aiPlaceholder", { command: props.aiCommand || "/kb" });
  }
  return t("chat.inputPlaceholder");
});

/** 输入末尾的 `@片段`：用于弹出在线成员联想 */
const mentionQuery = computed(() => {
  if (isAiRoom.value) return null;
  const matched = /@([\w.\-]*)$/.exec(draft.value);
  return matched ? matched[1].toLowerCase() : null;
});

const mentionCandidates = computed(() => {
  if (mentionQuery.value === null) return [];
  return props.contacts
    .filter(peer => {
      const name = (peer.username || "").toLowerCase();
      return !mentionQuery.value || name.includes(mentionQuery.value);
    })
    .slice(0, 6);
});

function insertMention(peer: ChatPeer) {
  draft.value = draft.value.replace(/@([\w.\-]*)$/, `@${peer.username} `);
}

function submit() {
  const content = draft.value.trim();
  if (!content) return;
  draft.value = "";
  // 由父组件按当前会话类型路由到「普通发送」或「AI 提问」
  emit("send", content);
}

// 切换会话时清空草稿（避免把 A 会话的内容发到 B 会话）
watch(
  () => props.room?.id,
  () => {
    draft.value = "";
  }
);
</script>

<template>
  <div class="relative flex h-full min-w-0 grow flex-col">
    <div
      class="flex items-center gap-2 border-b border-solid border-(--pure-border-color) px-3 py-2"
    >
      <el-button
        v-if="isNarrow"
        link
        :icon="useRenderIcon(MenuIcon)"
        :aria-label="t('chat.sessions')"
        @click="emit('toggleSidebar')"
      />
      <div class="min-w-0 grow">
        <div class="flex items-center gap-2">
          <span class="truncate font-medium">{{ title }}</span>
          <el-icon v-if="isAiRoom" class="text-(--el-color-primary)">
            <component :is="useRenderIcon(AiIcon)" />
          </el-icon>
          <el-tag v-if="!connected" size="small" type="warning">
            {{ t("chat.connecting") }}
          </el-tag>
        </div>
        <div class="truncate text-xs text-(--el-text-color-secondary)">
          {{ subtitle }}
        </div>
      </div>
    </div>

    <div
      ref="scrollEl"
      v-loading="loading"
      class="grow overflow-y-auto px-2 py-3"
      data-testid="chat-messages"
      @scroll.passive="emit('scroll')"
    >
      <div
        v-if="room"
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

      <template v-for="row in groups" :key="row.key">
        <div v-if="row.type === 'divider'" class="my-3 text-center">
          <span
            class="rounded bg-(--el-fill-color-light) px-2 py-0.5 text-xs text-(--el-text-color-secondary)"
          >
            {{ row.label }}
          </span>
        </div>
        <MessageBubble
          v-else
          :item="row.item"
          :mine="mine(row.item)"
          @recall="emit('recall', $event)"
          @resend="emit('resend', $event)"
        />
      </template>

      <div
        v-if="thinking"
        class="flex items-center gap-2 px-3 py-2 text-sm text-(--el-text-color-secondary)"
      >
        <el-avatar :size="30" class="bg-(--el-color-primary)">
          <el-icon><component :is="useRenderIcon(AiIcon)" /></el-icon>
        </el-avatar>
        <span class="animate-pulse">{{ t("chat.thinking") }}</span>
      </div>

      <el-empty
        v-if="room && !groups.length && !loading"
        :description="t('chat.emptyMessages')"
        :image-size="80"
      />
    </div>

    <div
      v-if="pendingCount > 0"
      class="absolute bottom-40 left-1/2 -translate-x-1/2 cursor-pointer"
      @click="emit('scrollToBottom')"
    >
      <el-tag type="primary" effect="dark" round>
        {{ t("chat.newMessages", { count: pendingCount }) }}
      </el-tag>
    </div>

    <div class="border-t border-solid border-(--pure-border-color) p-3">
      <div
        v-if="mentionCandidates.length"
        class="mb-2 rounded border border-solid border-(--pure-border-color) p-1"
      >
        <div
          v-for="peer in mentionCandidates"
          :key="peer.pk"
          class="cursor-pointer rounded px-2 py-1 text-sm hover:bg-(--el-fill-color-light)"
          @click="insertMention(peer)"
        >
          {{ peer.nickname || peer.username }}
          <span class="ml-1 text-xs text-(--el-text-color-secondary)"
            >@{{ peer.username }}</span
          >
        </div>
      </div>

      <!-- data-testid 挂原生 div：Element Plus 的 el-input（textarea 形态）不保证属性透传到内部 textarea -->
      <div data-testid="chat-input">
        <el-input
          v-model="draft"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="placeholder"
          :disabled="!room"
          @keydown.enter.exact.prevent="submit"
        />
      </div>
      <div class="mt-2 flex-bc">
        <div class="text-xs text-(--el-text-color-secondary)">
          <span v-if="isAiRoom && aiEnabled">{{ aiHint }}</span>
          <span v-else>{{ t("chat.enterHint") }}</span>
        </div>
        <el-button
          type="primary"
          :icon="useRenderIcon(SendIcon)"
          :disabled="!room || !draft.trim()"
          data-testid="chat-send"
          @click="submit"
        >
          {{ t("chat.send") }}
        </el-button>
      </div>
    </div>
  </div>
</template>
