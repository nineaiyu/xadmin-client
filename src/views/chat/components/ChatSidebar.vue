<script lang="ts" setup>
import { computed, h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReEmpty from "@/components/ReEmpty";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { chatApi, type ChatPeer, type ChatRoomItem } from "@/api/chat";
import ChatGroupCreateForm from "./ChatGroupCreateForm.vue";
import AiIcon from "~icons/ep/cpu";
import RoomIcon from "~icons/ep/chat-dot-square";
import GroupIcon from "~icons/ep/user-filled";
import PlusIcon from "~icons/ep/plus";
import SearchIcon from "~icons/ep/search";

/**
 * 左栏：搜索 + 会话列表（公共聊天室 / AI 助手 / 私聊 / 群聊，未读红点）+ 最近在线联系人。
 *
 * 点击会话切换右侧窗口；点击联系人开通（幂等复用）私聊并切换过去；
 * 会话区表头可新建群聊（远程搜索选成员，创建成功回调父级选中新群）。
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
  created: [ChatRoomItem];
}>();

const { t } = useI18n();
const keyword = ref("");

// ------------------------------------------------------------------ 新建群聊

/** 打开新建群聊弹窗（弹层体系统一收敛：addDialog + 内容组件） */
function openCreateGroupDialog() {
  const formRef = ref<InstanceType<typeof ChatGroupCreateForm> | null>(null);
  addDialog({
    title: t("chat.newGroup"),
    width: "420px",
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(ChatGroupCreateForm, { ref: formRef }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹层 loading 悬挂
      const res = await chatApi.createGroup(payload).catch(error => ({
        code: -1,
        data: null,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === SUCCESS_CODE && res.data) {
        done();
        emit("created", res.data);
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
}

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
  if (room.room_type === "group") return room.name || t("chat.groupMembers");
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
    class="flex h-full flex-col border-0 border-r border-solid border-(--pure-border-color)"
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
        <div class="flex-bc px-3 py-1">
          <span class="text-xs text-(--el-text-color-secondary)">
            {{ t("chat.sessions") }}
          </span>
          <el-tooltip :content="t('chat.newGroup')" placement="bottom">
            <el-button
              link
              size="small"
              data-testid="chat-new-group"
              :aria-label="t('chat.newGroup')"
              :icon="useRenderIcon(PlusIcon)"
              @click="openCreateGroupDialog"
            />
          </el-tooltip>
        </div>
        <div
          v-for="room in filteredRooms"
          :key="room.id"
          class="sidebar-item mx-2 mb-1 cursor-pointer rounded p-2"
          :class="{ 'is-active': room.id === activeRoomId }"
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
              <el-icon v-else-if="room.room_type === 'group'">
                <component :is="useRenderIcon(GroupIcon)" />
              </el-icon>
              <span v-else>{{
                (room.peer?.nickname || room.peer?.username || "?").slice(0, 1)
              }}</span>
            </el-avatar>
            <div class="min-w-0 grow">
              <div class="flex items-center gap-1">
                <span class="truncate text-sm">{{ roomTitle(room) }}</span>
                <span
                  v-if="room.room_type === 'group'"
                  class="shrink-0 text-xs text-(--el-text-color-secondary)"
                >
                  {{
                    t("chat.groupMemberCount", {
                      count: room.member_count ?? 0
                    })
                  }}
                </span>
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
        <ReEmpty
          v-if="!loading && !filteredRooms.length"
          :description="t('chat.emptyRooms')"
          size="small"
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
          class="sidebar-item mx-2 mb-1 cursor-pointer rounded px-2 py-1.5"
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
        <ReEmpty
          v-if="!loadingContacts && !filteredContacts.length"
          :description="t('chat.emptyContacts')"
          size="small"
        />
      </div>
    </el-scrollbar>
  </div>
</template>
