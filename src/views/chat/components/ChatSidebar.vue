<script lang="ts" setup>
import { computed, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  chatApi,
  type ChatPeer,
  type ChatRoomItem,
  type ChatUserOption
} from "@/api/chat";
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

const groupDialogVisible = ref(false);
const groupName = ref("");
const groupMemberPks = ref<number[]>([]);
/** 候选成员缓存：远程搜索与已选回显共用 */
const groupOptions = ref<ChatUserOption[]>([]);
const searchingMembers = ref(false);
const creatingGroup = ref(false);
let memberSearchTimer: number | undefined;

const canCreateGroup = computed(
  () => !!groupName.value.trim() && groupMemberPks.value.length > 0
);

function mergeGroupOptions(rows: ChatUserOption[]) {
  const known = new Set(groupOptions.value.map(item => item.pk));
  for (const row of rows) {
    if (!known.has(row.pk)) groupOptions.value.push(row);
  }
}

function groupUserLabel(user: ChatUserOption) {
  return user.nickname ? `${user.username}-${user.nickname}` : user.username;
}

/** 远程搜索候选成员（防抖 300ms） */
function onSearchMembers(value: string) {
  window.clearTimeout(memberSearchTimer);
  const word = (value ?? "").trim();
  if (!word) return;
  memberSearchTimer = window.setTimeout(async () => {
    searchingMembers.value = true;
    try {
      const { code, data } = await chatApi.searchChatUsers(word);
      if (code === SUCCESS_CODE) mergeGroupOptions(data ?? []);
    } finally {
      searchingMembers.value = false;
    }
  }, 300);
}

function openGroupDialog() {
  groupDialogVisible.value = true;
  groupName.value = "";
  groupMemberPks.value = [];
  groupOptions.value = [];
}

async function confirmCreateGroup() {
  if (!canCreateGroup.value) return;
  creatingGroup.value = true;
  try {
    const { code, data, detail } = await chatApi.createGroup({
      name: groupName.value.trim(),
      member_pks: [...groupMemberPks.value]
    });
    if (code === SUCCESS_CODE && data) {
      groupDialogVisible.value = false;
      emit("created", data);
    } else if (detail) {
      message(String(detail), { type: "warning" });
    }
  } finally {
    creatingGroup.value = false;
  }
}

onUnmounted(() => window.clearTimeout(memberSearchTimer));

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
              @click="openGroupDialog"
            />
          </el-tooltip>
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

    <!-- 新建群聊：群名称 + 成员多选（远程搜索候选） -->
    <el-dialog
      v-model="groupDialogVisible"
      :title="t('chat.newGroup')"
      width="420px"
      append-to-body
    >
      <el-form label-width="80px">
        <el-form-item :label="t('chat.groupName')" required>
          <el-input
            v-model="groupName"
            maxlength="64"
            :placeholder="t('chat.groupNamePlaceholder')"
            data-testid="chat-group-name"
          />
        </el-form-item>
        <el-form-item :label="t('chat.selectMembers')" required>
          <el-select
            v-model="groupMemberPks"
            class="w-full"
            multiple
            filterable
            remote
            reserve-keyword
            :loading="searchingMembers"
            :remote-method="onSearchMembers"
            :placeholder="t('chat.searchUserHint')"
            data-testid="chat-group-members-select"
          >
            <el-option
              v-for="user in groupOptions"
              :key="user.pk"
              :value="user.pk"
              :label="groupUserLabel(user)"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">
          {{ t("buttons.cancel") }}
        </el-button>
        <el-button
          type="primary"
          :loading="creatingGroup"
          :disabled="!canCreateGroup"
          data-testid="chat-group-create-confirm"
          @click="confirmCreateGroup"
        >
          {{ t("buttons.sure") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
