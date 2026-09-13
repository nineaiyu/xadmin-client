<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AiIcon from "~icons/ep/cpu";
import RoomIcon from "~icons/ep/chat-dot-square";
import SearchIcon from "~icons/ep/search";
import type { ChatPeer, ChatRoomItem } from "@/api/chat";

/**
 * 左栏：搜索 + 会话列表（公共聊天室 / AI 助手 / 私聊，未读红点）+ 最近在线联系人。
 *
 * 点击会话切换右侧窗口；点击联系人开通（幂等复用）私聊并切换过去。
 */
const props = defineProps<{
  rooms: ChatRoomItem[];
  contacts: ChatPeer[];
  activeRoomId: number;
  aiEnabled: boolean;
  aiHint: string;
  loading: boolean;
  loadingContacts: boolean;
}>();

const emit = defineEmits<{
  select: [number];
  openPrivate: [number];
  refreshContacts: [];
}>();

const { t } = useI18n();
const keyword = ref("");

const filteredRooms = computed(() => filterByName(props.rooms, roomTitle));
const filteredContacts = computed(() =>
  filterByName(props.contacts, item => item.nickname || item.username || "")
);

function filterByName<T>(list: T[], titleOf: (_item: T) => string) {
  const word = keyword.value.trim().toLowerCase();
  if (!word) return list;
  return list.filter(item => {
    if (titleOf(item).toLowerCase().includes(word)) return true;
    const extra = (item as unknown as RoomLike).last_message;
    return typeof extra === "string" && extra.toLowerCase().includes(word);
  });
}

type RoomLike = { last_message?: string };

function roomTitle(room: ChatRoomItem) {
  if (room.room_type === "ai") return t("chat.aiAssistant");
  if (room.room_type === "public") return t("chat.publicRoom");
  return room.peer?.nickname || room.peer?.username || t("chat.unknownUser");
}

function roomSubtitle(room: ChatRoomItem) {
  if (room.last_message) return room.last_message;
  if (room.room_type === "ai") return props.aiHint || t("chat.aiRoomHint");
  if (room.room_type === "public") return t("chat.publicRoomHint");
  return t("chat.noMessageYet");
}

function roomAvatar(room: ChatRoomItem) {
  return room.room_type === "private" ? room.peer?.avatar || "" : "";
}

function avatarText(peer: ChatPeer) {
  return (peer.nickname || peer.username || "?").slice(0, 1).toUpperCase();
}
</script>

<template>
  <div
    class="flex h-full flex-col border-r border-solid border-(--pure-border-color)"
  >
    <div class="p-3">
      <el-input
        v-model="keyword"
        :placeholder="t('chat.searchPlaceholder')"
        clearable
        :prefix-icon="useRenderIcon(SearchIcon)"
      />
    </div>

    <el-scrollbar class="grow">
      <div class="pb-4">
        <div class="px-3 py-1 text-xs text-(--el-text-color-secondary)">
          {{ t("chat.sessions") }}
        </div>
        <div
          v-for="room in filteredRooms"
          :key="room.id"
          class="mx-2 mb-1 cursor-pointer rounded p-2 transition-colors hover:bg-(--el-fill-color-light)"
          :class="{ 'bg-(--el-fill-color-light)': room.id === activeRoomId }"
          :data-testid="`chat-room-${room.room_type}`"
          @click="emit('select', room.id)"
        >
          <div class="flex items-center gap-2">
            <el-avatar
              :size="34"
              :src="roomAvatar(room) || undefined"
              class="shrink-0"
              :class="
                room.room_type === 'private'
                  ? 'bg-(--el-color-info-light-3)'
                  : 'bg-(--el-color-primary)'
              "
            >
              <el-icon v-if="room.room_type === 'ai'">
                <component :is="useRenderIcon(AiIcon)" />
              </el-icon>
              <el-icon v-else-if="room.room_type === 'public'">
                <component :is="useRenderIcon(RoomIcon)" />
              </el-icon>
              <span v-else>{{
                (room.peer?.nickname || room.peer?.username || "?").slice(0, 1)
              }}</span>
            </el-avatar>
            <div class="min-w-0 grow">
              <div class="flex items-center gap-1">
                <span class="truncate text-sm">{{ roomTitle(room) }}</span>
                <span
                  v-if="room.room_type === 'private'"
                  class="size-2 shrink-0 rounded-full"
                  :class="
                    room.peer?.online
                      ? 'bg-(--el-color-success)'
                      : 'bg-(--el-color-info-light-5)'
                  "
                />
              </div>
              <div class="truncate text-xs text-(--el-text-color-secondary)">
                {{ roomSubtitle(room) }}
              </div>
            </div>
            <el-badge
              v-if="room.unread_count > 0"
              :value="room.unread_count > 99 ? '99+' : room.unread_count"
              type="danger"
            />
          </div>
        </div>
        <el-empty
          v-if="!loading && !filteredRooms.length"
          :description="t('chat.emptyRooms')"
          :image-size="60"
        />
      </div>

      <div class="pb-4">
        <div class="flex-bc px-3 py-1">
          <span class="text-xs text-(--el-text-color-secondary)">
            {{ t("chat.contacts") }}
          </span>
          <el-button link size="small" @click="emit('refreshContacts')">
            {{ t("chat.refresh") }}
          </el-button>
        </div>
        <div
          v-for="peer in filteredContacts"
          :key="peer.pk"
          class="mx-2 mb-1 cursor-pointer rounded px-2 py-1.5 transition-colors hover:bg-(--el-fill-color-light)"
          :title="t('chat.openPrivate')"
          :data-testid="`chat-contact-${peer.username}`"
          @click="emit('openPrivate', peer.pk)"
        >
          <div class="flex items-center gap-2">
            <el-avatar
              :size="30"
              :src="peer.avatar || undefined"
              class="shrink-0"
            >
              {{ avatarText(peer) }}
            </el-avatar>
            <div class="min-w-0 grow">
              <div class="truncate text-sm">
                {{ peer.nickname || peer.username }}
              </div>
              <div class="text-xs text-(--el-text-color-secondary)">
                {{ peer.online ? t("chat.online") : t("chat.offline") }}
              </div>
            </div>
            <span
              class="size-2 rounded-full"
              :class="
                peer.online
                  ? 'bg-(--el-color-success)'
                  : 'bg-(--el-color-info-light-5)'
              "
            />
          </div>
        </div>
        <el-empty
          v-if="!loadingContacts && !filteredContacts.length"
          :description="t('chat.emptyContacts')"
          :image-size="60"
        />
      </div>
    </el-scrollbar>
  </div>
</template>
