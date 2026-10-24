<script lang="ts" setup>
import { computed, h, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import {
  desktopNotifyEnabled,
  disableDesktopNotify,
  enableDesktopNotify,
  isDesktopNotifySupported
} from "@/utils/desktopNotify";
import SendIcon from "~icons/ep/promotion";
import AiIcon from "~icons/ep/cpu";
import BellIcon from "~icons/ep/bell";
import BellFilledIcon from "~icons/ep/bell-filled";
import GroupIcon from "~icons/ep/user-filled";
import {
  type ChatAttachmentKind,
  type ChatMessageItem,
  type ChatPeer,
  type ChatRoomItem
} from "@/api/chat";
import MessageThreadPanel from "@/components/MessageThreadPanel";
import MessageTimeDivider from "@/components/MessageTimeDivider";
import AiStreamingBubble from "@/components/AiStreamingBubble";
import { useListAppendAnimation } from "@/hooks/useListAppendAnimation";
import { useChatMention } from "../hooks/useChatMention";
import MessageBubble from "./MessageBubble.vue";
import ChatComposerToolbar from "./ChatComposerToolbar.vue";
import ChatGroupMembersPanel from "./ChatGroupMembersPanel.vue";

/**
 * 右栏：会话头部 + 消息区（时间分组 / 向上加载 / 新消息悬浮条 / AI 流式气泡）+ 输入区。
 * 面板骨架（头部 / 消息列表壳 / 悬浮条 / 输入区容器）收敛于 MessageThreadPanel，
 * 与助手页 AiChatPanel 同一套壳；本组件只组装聊天室域内能力。
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
  /** WS 4403：无聊天室权限，停止显示“连接中” */
  denied?: boolean;
  pendingCount: number;
  isNarrow: boolean;
  /** 附件上传中（禁用重复触发） */
  uploading: boolean;
  /** 当前登录用户主键（表情回应徽标高亮自己的回应） */
  mePk: number;
}>();

const emit = defineEmits<{
  send: [string];
  /** 附件消息：文件 + 种类（image/video/audio/file，文件入口按 MIME 分流），上传与发送由父级驱动 */
  sendAttachment: [File, ChatAttachmentKind];
  recall: [ChatMessageItem];
  resend: [ChatMessageItem];
  /** 表情回应切换（chat_reaction 上行，全量回应表由广播帧回写） */
  react: [ChatMessageItem, string];
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
const inputWrap = ref<HTMLElement | null>(null);
const desktopOn = ref(desktopNotifyEnabled());

const isAiRoom = computed(() => props.room?.room_type === "ai");
const isPublicRoom = computed(() => props.room?.room_type === "public");
const isGroupRoom = computed(() => props.room?.room_type === "group");
/** 群成员列表是独立能力：无 members:ChatRoom 时不渲染入口（服务端同样 fail-closed） */
const canViewMembers = computed(() => hasAuth("members:ChatRoom"));
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

/** `@` 成员联想（候选口径与选中替换见 hooks/useChatMention.ts，行数门禁抽出） */
const { mentionCandidates, insertMention } = useChatMention({
  draft,
  room: computed(() => props.room),
  contacts: computed(() => props.contacts)
});

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

/** 附件入口按权限点收敛（上传走文件中心策略，服务端同样 fail-closed）；
 *  入口与隐藏选择器见 ChatComposerToolbar（行数门禁抽出） */
const canUploadAttachment = computed(() => hasAuth("upload:ChatMessage"));

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
  if (!room || !canViewMembers.value) return;
  const options: DialogOptions = {
    title: t("chat.groupMembers"),
    width: dialogSize("md"),
    destroyOnClose: true,
    hideFooter: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(ChatGroupMembersPanel, {
        room,
        onRoomChanged: (next: ChatRoomItem) => emit("roomChanged", next),
        onLeft: (roomId: number) => emit("left", roomId),
        // 面板底部自绘「关闭」按钮 emit close；弹窗体系统一由 closeDialog 收口
        onClose: () => closeDialog(options, 0)
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

/** 新增消息的进入动画标记：仅「尾部追加」播一次（切会话整批替换 / 加载更早不播） */
const { isFresh } = useListAppendAnimation(() =>
  props.groups.map(row => row.key)
);

function submit() {
  const content = draft.value.trim();
  if (!content) return;
  draft.value = "";
  // 由父组件按当前会话类型路由到「普通发送」或「AI 提问」
  emit("send", content);
}

// 切换会话时清空草稿（避免把 A 会话的内容发到 B 会话）。
// 只按「有效会话」比较：会话列表刷新 / 加载态会使 room 短暂为 undefined，
// 若把它当作一次切换，用户正在输入的内容会被清掉（发送按钮随即置灰）。
let lastRoomId: string | number | undefined;
watch(
  () => props.room?.id,
  id => {
    if (id === undefined) return;
    if (lastRoomId !== undefined && id !== lastRoomId) draft.value = "";
    lastRoomId = id;
  },
  { immediate: true }
);
</script>

<template>
  <MessageThreadPanel
    :title="title"
    title-testid="chat-room-title"
    :subtitle="subtitle"
    :toggle-label="t('chat.sessions')"
    :is-narrow="isNarrow"
    list-testid="chat-messages"
    skeleton-testid="chat-history-skeleton"
    :skeleton-visible="loading && !groups.length"
    :history-bar-visible="Boolean(room) && groups.length > 0"
    :has-more="hasMore"
    :loading-more="loadingMore"
    :empty-visible="
      Boolean(room) && !groups.length && !loading && !activeStreaming
    "
    :empty-text="t('chat.emptyMessages')"
    :pending-count="pendingCount"
    @toggle="emit('toggleSidebar')"
    @scroll="emit('scroll')"
    @load-more="emit('loadMore')"
    @ready="emit('scroller', $event)"
    @jump-to-latest="emit('scrollToBottom')"
  >
    <template #title-extras>
      <el-icon v-if="isAiRoom" class="text-(--el-color-primary)">
        <component :is="useRenderIcon(AiIcon)" />
      </el-icon>
      <el-tag v-if="denied" size="small" type="danger">
        {{ t("chat.noPermission") }}
      </el-tag>
      <el-tag v-else-if="!connected" size="small" type="warning">
        {{ t("chat.connecting") }}
      </el-tag>
    </template>

    <template #actions>
      <el-button
        v-if="isGroupRoom && canViewMembers"
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
    </template>

    <template v-for="row in groups" :key="row.key">
      <MessageTimeDivider v-if="row.type === 'divider'" :label="row.label" />
      <MessageBubble
        v-else
        :item="row.item"
        :mine="mine(row.item)"
        :me-pk="mePk"
        :fresh="isFresh(row.key)"
        @recall="emit('recall', $event)"
        @resend="emit('resend', $event)"
        @react="(item, emoji) => emit('react', item, emoji)"
      />
    </template>

    <!-- AI 流式回答气泡（SSE 增量逐字上屏；思考增量到达后先展示思考面板） -->
    <AiStreamingBubble
      v-if="activeStreaming"
      :reasoning="activeStreaming.reasoning"
      :content="activeStreaming.content"
      testid="chat-streaming"
      stop-testid="chat-stream-stop"
      :stop-label="t('chat.stopGenerating')"
      show-name
      :name-label="t('chat.aiAssistant')"
      @stop="emit('stopStream')"
    />

    <template #composer>
      <div
        v-if="mentionCandidates.length"
        class="mb-2 rounded border border-solid border-(--divider) p-1"
      >
        <div
          v-for="peer in mentionCandidates"
          :key="peer.pk"
          class="sidebar-item cursor-pointer rounded px-2 py-1 text-sm"
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
        <ChatComposerToolbar
          :can-upload="canUploadAttachment"
          :disabled="!room || uploading"
          @emoji="insertEmoji"
          @send-attachment="(file, kind) => emit('sendAttachment', file, kind)"
        />
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
    </template>
  </MessageThreadPanel>
</template>
