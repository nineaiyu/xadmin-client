<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  desktopNotifyEnabled,
  disableDesktopNotify,
  enableDesktopNotify,
  isDesktopNotifySupported
} from "@/utils/desktopNotify";
import MenuIcon from "~icons/ep/menu";
import SendIcon from "~icons/ep/promotion";
import AiIcon from "~icons/ep/cpu";
import EmojiIcon from "~icons/ri/emotion-line";
import BellIcon from "~icons/ep/bell";
import BellFilledIcon from "~icons/ep/bell-filled";
import GroupIcon from "~icons/ep/user-filled";
import {
  chatApi,
  type ChatMessageItem,
  type ChatPeer,
  type ChatRoomItem,
  type ChatUserOption
} from "@/api/chat";
import MessageBubble from "./MessageBubble.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条 / AI 流式气泡）+ 输入区。
 *
 * 输入区约定：Enter 发送、Shift+Enter 换行；`@` 触发在线成员联想；工具条支持表情包
 * 插入（光标处）；AI 会话支持 `/kb 问题` 走知识库问答；头部可开关桌面通知（全站生效）。
 */

/** 常用表情（不引第三方依赖，保持包体；点击在光标处插入） */
const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "😘",
  "😜",
  "🤔",
  "😎",
  "😭",
  "😅",
  "🙄",
  "😡",
  "🥳",
  "🤗",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "🤝",
  "✌️",
  "👌",
  "❤️",
  "💔",
  "💯",
  "🔥",
  "⭐",
  "🎉",
  "🎊",
  "🎁",
  "☕",
  "🍵",
  "🍺",
  "🍰",
  "🍎",
  "🍉",
  "🍚",
  "🍜",
  "🐶",
  "🐱",
  "🐭",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "☀️",
  "🌈",
  "⛅",
  "🌧️",
  "❄️",
  "🌙",
  "🌸",
  "🌻",
  "🚀",
  "🛸",
  "🏠",
  "💻",
  "📱",
  "⏰",
  "📚",
  "✅"
];

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
  /** AI 流式回答（SSE）：roomId 为归属会话，content 为已到达增量 */
  streaming: { roomId: number; content: string } | null;
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
  /** 群信息变更（改名 / 成员增减）后回传最新会话行 */
  roomChanged: [ChatRoomItem];
  /** 退出群聊成功（携带被退出的会话主键） */
  left: [number];
}>();

const { t } = useI18n();
const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);
const inputWrap = ref<HTMLElement | null>(null);
const emojiVisible = ref(false);
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

const membersVisible = ref(false);
const membersLoading = ref(false);
const groupMemberList = ref<ChatPeer[]>([]);
const renameValue = ref("");
const renaming = ref(false);
const addMemberPks = ref<number[]>([]);
/** 待添加成员候选缓存：远程搜索与已选回显共用 */
const memberOptions = ref<ChatUserOption[]>([]);
const searchingMembers = ref(false);
const savingMembers = ref(false);
let memberSearchTimer: number | undefined;

/** 仅群主可改名 / 增删成员；所有成员均可退出群聊 */
const isOwner = computed(() => !!props.room?.is_owner);

function memberLabel(user: ChatUserOption) {
  return user.nickname ? `${user.username}-${user.nickname}` : user.username;
}

function avatarText(peer: ChatPeer) {
  return (peer.nickname || peer.username || "?").slice(0, 1).toUpperCase();
}

function mergeMemberOptions(rows: ChatUserOption[]) {
  const known = new Set(memberOptions.value.map(item => item.pk));
  for (const row of rows) {
    if (!known.has(row.pk)) memberOptions.value.push(row);
  }
}

/** 远程搜索待添加成员（防抖 300ms） */
function searchMemberOptions(value: string) {
  window.clearTimeout(memberSearchTimer);
  const word = (value ?? "").trim();
  if (!word) return;
  memberSearchTimer = window.setTimeout(async () => {
    searchingMembers.value = true;
    try {
      const { code, data } = await chatApi.searchChatUsers(word);
      if (code === SUCCESS_CODE) mergeMemberOptions(data ?? []);
    } finally {
      searchingMembers.value = false;
    }
  }, 300);
}

function isMember(pk: number) {
  return groupMemberList.value.some(item => item.pk === pk);
}

/** 拉取完整成员列表，并把最新会话行回传父级同步列表 */
async function loadMembers() {
  if (!props.room) return;
  membersLoading.value = true;
  try {
    const { code, data, detail } = await chatApi.groupMembers(props.room.id);
    if (code === SUCCESS_CODE && data) {
      groupMemberList.value = data.members ?? [];
      emit("roomChanged", data.room);
    } else if (detail) {
      message(String(detail), { type: "warning" });
    }
  } finally {
    membersLoading.value = false;
  }
}

function openMembers() {
  membersVisible.value = true;
  renameValue.value = props.room?.name ?? "";
  addMemberPks.value = [];
  memberOptions.value = [];
  loadMembers();
}

async function submitAddMembers() {
  if (!props.room || !addMemberPks.value.length) return;
  savingMembers.value = true;
  try {
    const { code, data, detail } = await chatApi.updateGroupMembers(
      props.room.id,
      { add: [...addMemberPks.value] }
    );
    if (code === SUCCESS_CODE && data) {
      addMemberPks.value = [];
      emit("roomChanged", data);
      await loadMembers();
    } else if (detail) {
      message(String(detail), { type: "warning" });
    }
  } finally {
    savingMembers.value = false;
  }
}

async function removeMember(peer: ChatPeer) {
  if (!props.room) return;
  savingMembers.value = true;
  try {
    const { code, data, detail } = await chatApi.updateGroupMembers(
      props.room.id,
      { remove: [peer.pk] }
    );
    if (code === SUCCESS_CODE && data) {
      emit("roomChanged", data);
      await loadMembers();
    } else if (detail) {
      message(String(detail), { type: "warning" });
    }
  } finally {
    savingMembers.value = false;
  }
}

async function submitRename() {
  if (!props.room) return;
  const name = renameValue.value.trim();
  if (!name || name === props.room.name) return;
  renaming.value = true;
  try {
    const { code, data, detail } = await chatApi.renameGroup(
      props.room.id,
      name
    );
    if (code === SUCCESS_CODE && data) {
      emit("roomChanged", data);
    } else if (detail) {
      message(String(detail), { type: "warning" });
    }
  } finally {
    renaming.value = false;
  }
}

/** 退出群聊（二次确认；群主退出由服务端自动转让） */
async function leaveGroup() {
  const room = props.room;
  if (!room) return;
  try {
    await ElMessageBox.confirm(t("chat.leaveGroupConfirm"), {
      confirmButtonText: t("chat.leaveGroup"),
      cancelButtonText: t("buttons.cancel"),
      type: "warning",
      confirmButtonClass: "el-button--danger",
      draggable: true
    });
  } catch {
    return;
  }
  const { code, detail } = await chatApi.leaveGroup(room.id);
  if (code === SUCCESS_CODE) {
    membersVisible.value = false;
    emit("left", room.id);
  } else if (detail) {
    message(String(detail), { type: "warning" });
  }
}

onUnmounted(() => window.clearTimeout(memberSearchTimer));

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
      <el-button
        v-if="isGroupRoom"
        link
        data-testid="chat-group-members"
        :aria-label="t('chat.groupMembers')"
        :title="t('chat.groupMembers')"
        :icon="useRenderIcon(GroupIcon)"
        @click="openMembers"
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

      <!-- AI 流式回答气泡（SSE 增量逐字上屏；首个增量到达前显示思考占位） -->
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
          <div
            class="rounded-lg bg-(--el-fill-color-light) px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap text-(--el-text-color-primary)"
          >
            <template v-if="activeStreaming.content">
              {{ activeStreaming.content }}<span class="chat-cursor">▍</span>
            </template>
            <span v-else class="animate-pulse">
              {{ t("chat.thinking") }}
            </span>
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
      <div ref="inputWrap" data-testid="chat-input">
        <div class="flex items-center gap-1 pb-1">
          <el-popover
            v-model:visible="emojiVisible"
            placement="top-start"
            :width="296"
            trigger="click"
          >
            <template #reference>
              <el-button
                link
                :aria-label="t('chat.emoji')"
                :title="t('chat.emoji')"
                data-testid="chat-emoji"
                :icon="useRenderIcon(EmojiIcon)"
              />
            </template>
            <div
              class="grid grid-cols-8 gap-0.5"
              data-testid="chat-emoji-panel"
            >
              <button
                v-for="item in EMOJIS"
                :key="item"
                type="button"
                class="rounded text-lg/8 transition-colors hover:bg-(--el-fill-color)"
                @click="insertEmoji(item)"
              >
                {{ item }}
              </button>
            </div>
          </el-popover>
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

    <!-- 群成员：完整成员列表；群主可改名/增删成员，所有成员可退出群聊 -->
    <el-dialog
      v-model="membersVisible"
      :title="t('chat.groupMembers')"
      width="480px"
      append-to-body
    >
      <div v-loading="membersLoading">
        <div v-if="isOwner" class="mb-3 flex items-center gap-2">
          <el-input
            v-model="renameValue"
            maxlength="64"
            :placeholder="t('chat.groupNamePlaceholder')"
            data-testid="chat-group-rename-input"
          />
          <el-button
            :loading="renaming"
            :disabled="!renameValue.trim() || renameValue.trim() === room?.name"
            data-testid="chat-group-rename"
            @click="submitRename"
          >
            {{ t("chat.renameGroup") }}
          </el-button>
        </div>

        <div v-if="isOwner" class="mb-3 flex items-center gap-2">
          <el-select
            v-model="addMemberPks"
            class="grow"
            multiple
            filterable
            remote
            reserve-keyword
            :loading="searchingMembers"
            :remote-method="searchMemberOptions"
            :placeholder="t('chat.searchUserHint')"
            data-testid="chat-group-add-select"
          >
            <el-option
              v-for="user in memberOptions"
              :key="user.pk"
              :value="user.pk"
              :label="memberLabel(user)"
              :disabled="isMember(user.pk)"
            />
          </el-select>
          <el-button
            type="primary"
            :loading="savingMembers"
            :disabled="!addMemberPks.length"
            data-testid="chat-group-add-confirm"
            @click="submitAddMembers"
          >
            {{ t("chat.addMember") }}
          </el-button>
        </div>

        <div
          v-for="member in groupMemberList"
          :key="member.pk"
          class="flex items-center gap-2 border-b border-solid border-(--pure-border-color) py-1.5"
          :data-testid="`chat-group-member-${member.pk}`"
        >
          <el-avatar
            :size="30"
            :src="member.avatar || undefined"
            class="shrink-0"
          >
            {{ avatarText(member) }}
          </el-avatar>
          <div class="min-w-0 grow truncate text-sm">
            {{ member.nickname || member.username }}
          </div>
          <el-tag v-if="member.pk === room?.owner_pk" size="small">
            {{ t("chat.groupOwner") }}
          </el-tag>
          <el-button
            v-if="isOwner && member.pk !== room?.owner_pk"
            link
            type="danger"
            size="small"
            :title="t('chat.removeMember')"
            @click="removeMember(member)"
          >
            {{ t("chat.removeMember") }}
          </el-button>
        </div>
        <el-empty
          v-if="!membersLoading && !groupMemberList.length"
          :description="t('chat.emptyMembers')"
          :image-size="60"
        />
      </div>
      <template #footer>
        <el-button type="danger" plain @click="leaveGroup">
          {{ t("chat.leaveGroup") }}
        </el-button>
        <el-button @click="membersVisible = false">
          {{ t("buttons.close") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/* AI 流式输出的光标闪烁（SSE 增量逐字上屏） */
.chat-cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--el-color-primary);
  animation: chat-cursor-blink 1s step-end infinite;
}

@keyframes chat-cursor-blink {
  50% {
    opacity: 0;
  }
}
</style>
