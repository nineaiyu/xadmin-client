<script lang="ts" setup>
import { computed, h, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog, type DialogOptions } from "@/components/ReDialog";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import {
  desktopNotifyEnabled,
  disableDesktopNotify,
  enableDesktopNotify,
  isDesktopNotifySupported
} from "@/utils/desktopNotify";
import MenuIcon from "~icons/ep/menu";
import SendIcon from "~icons/ep/promotion";
import AiIcon from "~icons/ep/cpu";
import BellIcon from "~icons/ep/bell";
import BellFilledIcon from "~icons/ep/bell-filled";
import GroupIcon from "~icons/ep/user-filled";
import {
  type ChatMessageItem,
  type ChatPeer,
  type ChatRoomItem
} from "@/api/chat";
import MessageBubble from "./MessageBubble.vue";
import ChatEmojiPanel from "./ChatEmojiPanel.vue";
import ChatGroupMembersPanel from "./ChatGroupMembersPanel.vue";
import AiMessageBlock from "@/components/AiMessageBlock/index.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条 / AI 流式气泡）+ 输入区。
 *
 * 输入区约定：Enter 发送、Shift+Enter 换行；`@` 触发在线成员联想；工具条支持表情包
 * 插入（光标处）；AI 会话支持 `/kb 问题` 走知识库问答；头部可开关桌面通知（全站生效）。
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
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** AI 流式回答（SSE）：roomId 为归属会话，reasoning/content 为已到达增量 */
  streaming: { roomId: number; content: string; reasoning: string } | null;
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
  /** 停止生成（中断进行中的 AI 流式响应） */
  stopStream: [];
  /** 群信息变更（改名 / 成员增减）后回传最新会话行 */
  roomChanged: [ChatRoomItem];
  /** 退出群聊成功（携带被退出的会话主键） */
  left: [number];
}>();

const { t } = useI18n();
const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);
const inputWrap = ref<HTMLElement | null>(null);
const desktopOn = ref(desktopNotifyEnabled());

onMounted(() => emit("scroller", scrollEl.value));

const isAiRoom = computed(() => props.room?.room_type === "ai");
const isPublicRoom = computed(() => props.room?.room_type === "public");
const isGroupRoom = computed(() => props.room?.room_type === "group");
const onlineCount = computed(
  () => props.contacts.filter(item => item.online).length
);

const title = computed(() => {
  if (!props.room) return t("chat.selectRoom");
  if (isAiRoom.value) return t("chat.aiAssistant");
  if (isPublicRoom.value) return t("chat.publicRoom");
  if (isGroupRoom.value) return props.room.name || t("chat.groupMembers");
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
  if (isGroupRoom.value)
    return t("chat.groupMemberCount", { count: props.room.member_count ?? 0 });
  return props.room.peer?.online ? t("chat.online") : t("chat.offline");
});

const placeholder = computed(() => {
  // aiHint 来自后端（含 /kb 与 /do 的完整提示），空时回落到本地的 /kb 提示
  if (isAiRoom.value) {
    return props.aiHint || t("chat.aiPlaceholder", { command: "/kb" });
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

/** 表情包：在光标处插入（无选区时追加末尾），插入后恢复焦点与光标位置 */
function insertEmoji(emoji: string) {
  const textarea = inputWrap.value?.querySelector("textarea");
  const start = textarea?.selectionStart ?? draft.value.length;
  const end = textarea?.selectionEnd ?? start;
  draft.value = draft.value.slice(0, start) + emoji + draft.value.slice(end);
  nextTick(() => {
    if (!textarea) return;
    const position = start + emoji.length;
    textarea.focus();
    textarea.setSelectionRange(position, position);
  });
}

/** 桌面通知开关（全站生效）：开启时按需申请权限，拒绝则保持关闭并提示 */
async function toggleDesktopNotify() {
  if (desktopOn.value) {
    disableDesktopNotify();
    desktopOn.value = false;
    return;
  }
  if (!isDesktopNotifySupported()) {
    message(t("chat.desktopNotifyUnsupported"), { type: "warning" });
    return;
  }
  const enabled = await enableDesktopNotify();
  desktopOn.value = enabled;
  if (!enabled) {
    message(t("chat.desktopNotifyDenied"), { type: "warning" });
  }
}

// ------------------------------------------------------------------ 群成员管理

/** 打开群成员管理面板（弹层体系统一收敛：addDialog + 内容组件） */
function openMembersDialog() {
  const room = props.room;
  if (!room) return;
  const options: DialogOptions = {
    title: t("chat.groupMembers"),
    width: "480px",
    destroyOnClose: true,
    hideFooter: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(ChatGroupMembersPanel, {
        room,
        onRoomChanged: (next: ChatRoomItem) => emit("roomChanged", next),
        onLeft: (roomId: number) => emit("left", roomId)
      })
  };
  addDialog(options);
}

/** 流式气泡归属当前会话才渲染（切会话后残留的流不显示） */
const activeStreaming = computed(() =>
  props.streaming && props.streaming.roomId === props.room?.id
    ? props.streaming
    : null
);

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
      class="flex items-center gap-2 border-0 border-b border-solid border-(--pure-border-color) px-3 py-2"
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
          <!-- E2E 以标题判定「会话切换完成」（切房会清空草稿，早于切换完成的输入会被清掉） -->
          <span class="truncate font-medium" data-testid="chat-room-title">
            {{ title }}
          </span>
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
      <el-button
        v-if="isGroupRoom"
        link
        data-testid="chat-group-members"
        :aria-label="t('chat.groupMembers')"
        :title="t('chat.groupMembers')"
        :icon="useRenderIcon(GroupIcon)"
        @click="openMembersDialog"
      />
      <el-tooltip
        :content="
          desktopOn ? t('chat.desktopNotifyOn') : t('chat.desktopNotifyOff')
        "
        placement="bottom"
      >
        <el-button
          link
          data-testid="chat-desktop-notify"
          :aria-label="t('chat.desktopNotify')"
          :icon="useRenderIcon(desktopOn ? BellFilledIcon : BellIcon)"
          :class="
            desktopOn
              ? 'text-(--el-color-primary)'
              : 'text-(--el-text-color-secondary)'
          "
          @click="toggleDesktopNotify"
        />
      </el-tooltip>
    </div>

    <div
      ref="scrollEl"
      v-loading="loading"
      class="grow overflow-y-auto px-2 py-3"
      data-testid="chat-messages"
      @scroll.passive="emit('scroll')"
    >
      <!-- 仅在有历史消息时显示「加载更早 / 没有更多」：空会话由中部空态统一表达，
           否则顶部「没有更多历史消息」与中部「还没有消息」同时出现、文案矛盾 -->
      <div
        v-if="room && groups.length"
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

      <!-- AI 流式回答气泡（SSE 增量逐字上屏；思考增量到达后先展示思考面板） -->
      <div
        v-if="activeStreaming"
        class="flex gap-2 px-2 py-1.5"
        data-testid="chat-streaming"
      >
        <el-avatar :size="36" class="shrink-0 bg-(--el-color-primary)">
          <el-icon><component :is="useRenderIcon(AiIcon)" /></el-icon>
        </el-avatar>
        <div class="flex min-w-0 max-w-[72%] flex-col">
          <div class="mb-1 text-xs text-(--el-text-color-secondary)">
            {{ t("chat.aiAssistant") }}
          </div>
          <!-- 与 AI 助手页同一套布局：思考面板 + 流式正文 + 光标 -->
          <AiMessageBlock
            :reasoning="activeStreaming.reasoning"
            :content="activeStreaming.content"
            streaming
          />
          <!-- 停止生成：思考型模型输出可能较长，允许用户中断（已到达增量不落库） -->
          <div class="mt-1">
            <el-button
              link
              type="info"
              size="small"
              data-testid="chat-stream-stop"
              @click="emit('stopStream')"
            >
              {{ t("chat.stopGenerating") }}
            </el-button>
          </div>
        </div>
      </div>

      <el-empty
        v-if="room && !groups.length && !loading && !activeStreaming"
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

    <div
      class="border-0 border-t border-solid border-(--pure-border-color) p-3"
    >
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
      <div ref="inputWrap" data-testid="chat-input">
        <div class="flex items-center gap-1 pb-1">
          <ChatEmojiPanel @select="insertEmoji" />
        </div>
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
