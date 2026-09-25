<script lang="ts" setup>
import { onActivated, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import type { ChatMessageItem, ChatRoomItem } from "@/api/chat";
import { useChat } from "./hooks/useChat";
import { ReNavDrawer } from "@/components/ReNavDrawer";
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
/** 面板高度：按视口实测（与 AI 助手页同一口径），替代
 *  calc(100vh - 164px) 魔数——标签栏显隐 / 窗口尺寸变化都自适应 */
const pageRef = ref<HTMLElement | null>(null);
const PANEL_MIN_HEIGHT = 420;
const PANEL_BOTTOM_GAP = 24;
const panelHeight = ref(PANEL_MIN_HEIGHT);

function measurePanelHeight() {
  const el = pageRef.value;
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  // 页脚与面板同处一个滚动容器（紧随其后）：不扣除会把「面板 + 页脚」顶出视口，整页出现滚动
  const footer = document.querySelector(".layout-footer");
  const footerHeight = footer instanceof HTMLElement ? footer.offsetHeight : 0;
  panelHeight.value = Math.max(
    Math.round(window.innerHeight - top - PANEL_BOTTOM_GAP - footerHeight),
    PANEL_MIN_HEIGHT
  );
}

function updateViewport() {
  isNarrow.value = window.innerWidth < 768;
  measurePanelHeight();
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
  // keep-alive 返回聊天页：重测面板高度 + 刷新在线态（连接由 onUnmounted 关闭，需重连）
  measurePanelHeight();
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

/** 新建群聊成功：并入列表并选中新群 */
function createdGroup(room: ChatRoomItem) {
  chat.roomState.upsertRoom(room);
  chat.activate(room.id);
  if (isNarrow.value) drawerVisible.value = false;
}

/** 群改名 / 成员增减后同步列表行（成员数、群名） */
function groupChanged(room: ChatRoomItem) {
  chat.roomState.upsertRoom(room);
}

/** 退出群聊成功：刷新列表，当前会话已失效时切到首个会话 */
async function groupLeft(roomId: number) {
  await chat.roomState.loadRooms();
  if (
    chat.activeRoomId.value === roomId ||
    !chat.rooms.value.some(item => item.id === chat.activeRoomId.value)
  ) {
    chat.activate(chat.rooms.value[0]?.id ?? 0);
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
    ref="pageRef"
    class="chat-page flex overflow-hidden rounded bg-bg_color"
    :style="{ height: `${panelHeight}px`, minHeight: `${PANEL_MIN_HEIGHT}px` }"
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
      @created="createdGroup"
    />

    <ReNavDrawer v-model="drawerVisible" :narrow="isNarrow">
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
    </ReNavDrawer>

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
      @stop-stream="chat.abortStream"
      @load-more="chat.loadMore"
      @scroll="chat.onScroll"
      @scroll-to-bottom="chat.scrollToBottom"
      @scroller="chat.scroller.value = $event"
      @toggle-sidebar="drawerVisible = true"
      @room-changed="groupChanged"
      @left="groupLeft"
    />
  </div>
</template>

<style lang="scss" scoped>
.chat-page {
  border: 1px solid var(--pure-border-color);
}
</style>
