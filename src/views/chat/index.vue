<script lang="ts" setup>
import { onActivated, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import type { ChatMessageItem } from "@/api/chat";
import { useChat } from "./hooks/useChat";
import ChatSidebar from "./components/ChatSidebar.vue";
import ChatWindow from "./components/ChatWindow.vue";

/**
 * 聊天室：微信式两栏布局。
 *
 * 左栏 = 会话（公共聊天室 / AI 助手 / 私聊，未读红点）+ 最近在线联系人；
 * 右栏 = 消息气泡 + 输入区。窄屏（<768px）左栏折叠为抽屉。
 *
 * 路由/keep-alive 依赖组件名 `Chat`（user store 的通知点击跳本页）。
 */
defineOptions({
  name: "Chat"
});

const { t } = useI18n();
const route = useRoute();
const chat = useChat();
const drawerVisible = ref(false);
const isNarrow = ref(false);

function updateViewport() {
  isNarrow.value = window.innerWidth < 768;
}

/** 站内信通知点击跳转时会带 `?room=<id>`：定位到目标会话 */
function applyRouteRoom() {
  const roomId = Number(route.query.room ?? 0);
  if (roomId && chat.rooms.value.some(item => item.id === roomId)) {
    chat.activate(roomId);
  }
}

/** 在线态轮询（30s）：联系人进出与私聊对端在线点按此粒度刷新 */
let presenceTimer: number | undefined;

function refreshPresence() {
  chat.roomState.loadContacts();
  chat.roomState.loadRooms();
}

onMounted(async () => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
  await Promise.all([
    chat.roomState.loadRooms(),
    chat.roomState.loadContacts()
  ]);
  applyRouteRoom();
  chat.connect();
  presenceTimer = window.setInterval(refreshPresence, 30_000);
});

watch(() => route.query.room, applyRouteRoom);

onActivated(() => {
  // keep-alive 返回聊天页：刷新在线态（连接由 onUnmounted 关闭，需重连）
  refreshPresence();
  if (!chat.connected.value) chat.connect();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateViewport);
  if (presenceTimer) window.clearInterval(presenceTimer);
});

function selectRoom(roomId: number) {
  chat.activate(roomId);
  if (isNarrow.value) drawerVisible.value = false;
}

async function openPrivate(peerPk: number) {
  const { ok, detail } = await chat.roomState.openPrivate(peerPk);
  if (ok) {
    if (isNarrow.value) drawerVisible.value = false;
  } else if (detail) {
    message(String(detail), { type: "warning" });
  }
}

function submit(content: string) {
  if (chat.activeRoom.value?.room_type === "ai") chat.sendAi(content);
  else chat.send(content);
}

async function recall(item: ChatMessageItem) {
  try {
    await ElMessageBox.confirm(t("chat.recallConfirm"), {
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel"),
      type: "warning",
      confirmButtonClass: "el-button--danger",
      draggable: true
    });
  } catch {
    return;
  }
  await chat.recall(item);
}
</script>

<template>
  <div
    class="chat-page flex overflow-hidden rounded bg-bg_color"
    :style="{ height: 'calc(100vh - 164px)', minHeight: '420px' }"
    data-testid="chat-page"
  >
    <ChatSidebar
      v-if="!isNarrow"
      class="w-70 shrink-0"
      :rooms="chat.rooms.value"
      :contacts="chat.contacts.value"
      :active-room-id="chat.activeRoomId.value"
      :ai-enabled="chat.roomState.aiEnabled.value"
      :ai-hint="chat.roomState.aiHint.value"
      :loading="chat.roomState.loadingRooms.value"
      :loading-contacts="chat.roomState.loadingContacts.value"
      @select="selectRoom"
      @open-private="openPrivate"
      @refresh-contacts="chat.roomState.loadContacts()"
    />

    <el-drawer
      v-if="isNarrow"
      v-model="drawerVisible"
      direction="ltr"
      size="80%"
      :with-header="false"
    >
      <ChatSidebar
        :rooms="chat.rooms.value"
        :contacts="chat.contacts.value"
        :active-room-id="chat.activeRoomId.value"
        :ai-enabled="chat.roomState.aiEnabled.value"
        :ai-hint="chat.roomState.aiHint.value"
        :loading="chat.roomState.loadingRooms.value"
        :loading-contacts="chat.roomState.loadingContacts.value"
        @select="selectRoom"
        @open-private="openPrivate"
        @refresh-contacts="chat.roomState.loadContacts()"
      />
    </el-drawer>

    <ChatWindow
      class="grow"
      :room="chat.activeRoom.value"
      :groups="chat.messageGroups.value"
      :mine="chat.isMine"
      :contacts="chat.contacts.value"
      :ai-enabled="chat.roomState.aiEnabled.value"
      :ai-hint="chat.roomState.aiHint.value"
      :loading="chat.loadingHistory.value"
      :has-more="chat.hasMore.value"
      :loading-more="chat.loadingMore.value"
      :streaming="chat.streaming.value"
      :connected="chat.connected.value"
      :pending-count="chat.pendingCount.value"
      :is-narrow="isNarrow"
      @send="submit"
      @recall="recall"
      @resend="chat.resend"
      @load-more="chat.loadMore"
      @scroll="chat.onScroll"
      @scroll-to-bottom="chat.scrollToBottom"
      @scroller="chat.scroller.value = $event"
      @toggle-sidebar="drawerVisible = true"
    />
  </div>
</template>

<style lang="scss" scoped>
.chat-page {
  border: 1px solid var(--pure-border-color);
}
</style>
