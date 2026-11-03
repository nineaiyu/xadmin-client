<script lang="ts" setup>
import { computed, h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReEmpty from "@/components/ReEmpty";
import { addDialog, type DialogOptions } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import { useDialogForm } from "@/hooks/useDialogForm";
import { filterByKeyword } from "@/utils/keywordFilter";
import { formatTimeDivider } from "@/utils/timeGroups";
import {
  chatApi,
  type ChatGroupCreatePayload,
  type ChatPeer,
  type ChatRoomItem
} from "@/api/chat";
import ChatGroupCreateForm from "./ChatGroupCreateForm.vue";
import AiIcon from "~icons/ep/cpu";
import RoomIcon from "~icons/ep/chat-dot-square";
import GroupIcon from "~icons/ep/user-filled";
import PlusIcon from "~icons/ep/plus";
import SearchIcon from "~icons/ep/search";
import { hasAuth } from "@/router/utils";

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
  loadError: boolean;
}>();

const emit = defineEmits<{
  select: [number];
  openPrivate: [number];
  refreshContacts: [];
  retryRooms: [];
  created: [ChatRoomItem];
}>();

const { t } = useI18n();
const keyword = ref("");

/** 新建群聊入口按权限点显隐（服务端同样 fail-closed：无权限时不必渲染无效入口） */
const canCreateGroup = computed(() => hasAuth("createGroup:ChatRoom"));

// ------------------------------------------------------------------ 新建群聊

/** 打开新建群聊弹窗（弹层体系统一收敛：addDialog + 内容组件 + 类型化载荷通道） */
function openCreateGroupDialog() {
  const options: DialogOptions<ChatGroupCreatePayload> & {
    payload: ChatGroupCreatePayload;
  } = {
    title: t("chat.newGroup"),
    width: dialogSize("sm"),
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    payload: { name: "", member_pks: [] },
    contentRenderer: () => h(ChatGroupCreateForm)
  };
  const { beforeSure } = useDialogForm<ChatGroupCreatePayload>({
    // 草稿由内容组件经载荷通道实时回写；提交校验归打开方——校验不过返回 null，
    // 由底座复位按钮 loading 并保持弹层打开（原先手写 closeLoading）。
    // 通道挂在 addDialog 的同一选项对象上，故 readPayload 直接读该对象
    // （读取发生在提交时，此时 addDialog 已注入 getData）
    readPayload: () => {
      const payload = options.getData?.();
      if (!payload?.name) {
        message(t("chat.groupNameRequired"), { type: "warning" });
        return null;
      }
      if (!payload.member_pks.length) {
        message(t("chat.membersRequired"), { type: "warning" });
        return null;
      }
      return payload;
    },
    submit: payload => chatApi.createGroup(payload),
    onSuccess: res => {
      const created = res.data as ChatRoomItem | null | undefined;
      if (created) emit("created", created);
    }
  });
  options.beforeSure = beforeSure;
  addDialog<ChatGroupCreatePayload>(options);
}

/** 房间过滤：标题（AI / 公开房间用 i18n 名）或最近消息命中 */
const filteredRooms = computed(() =>
  filterByKeyword(props.rooms, keyword.value, room => [
    roomTitle(room),
    (room as RoomLike).last_message
  ])
);
/** 联系人过滤：昵称或用户名命中 */
const filteredContacts = computed(() =>
  filterByKeyword(props.contacts, keyword.value, item => [
    item.nickname,
    item.username
  ])
);

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

/** 会话行时间戳：复用消息流分组口径（今天 HH:mm / 昨天 / 月-日 HH:mm） */
function roomTime(room: ChatRoomItem) {
  return formatTimeDivider(
    new Date(room.last_message_time).getTime(),
    t("chat.yesterday")
  );
}

function avatarText(peer: ChatPeer) {
  return Array.from(peer.nickname || peer.username || "?")[0].toUpperCase();
}
</script>

<template>
  <div
    class="flex h-full flex-col border-0 border-r border-solid border-(--divider)"
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
          <el-tooltip
            v-if="canCreateGroup"
            :content="t('chat.newGroup')"
            placement="bottom"
          >
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
            <div class="relative shrink-0">
              <el-avatar
                class="avatar-md"
                :src="roomAvatar(room) || undefined"
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
                  Array.from(
                    room.peer?.nickname || room.peer?.username || "?"
                  )[0]
                }}</span>
              </el-avatar>
              <!-- 私聊在线点：头像右下角标（会话行与联系人行同位同语义） -->
              <span
                v-if="room.room_type === 'private'"
                class="absolute right-0 bottom-0 size-2.5 rounded-full border border-solid border-(--el-bg-color)"
                :class="
                  room.peer?.online
                    ? 'bg-(--el-color-success)'
                    : 'bg-(--el-color-info-light-5)'
                "
              />
            </div>
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
              </div>
              <div class="truncate text-xs text-(--el-text-color-secondary)">
                {{ roomSubtitle(room) }}
              </div>
            </div>
            <!-- 右列：未读 badge 在上、最近消息时间在下（最新在上，与排序语义一致） -->
            <div class="flex shrink-0 flex-col items-end gap-0.5 self-center">
              <el-badge
                v-if="room.unread_count > 0"
                class="tabular-nums"
                :value="room.unread_count > 99 ? '99+' : room.unread_count"
                type="danger"
              />
              <span
                v-if="room.last_message_time"
                class="text-xs text-fg-muted tabular-nums"
              >
                {{ roomTime(room) }}
              </span>
            </div>
          </div>
        </div>
        <ReEmpty
          v-if="!loading && !filteredRooms.length"
          size="small"
          :description="
            loadError ? t('chat.loadRoomsFailed') : t('chat.emptyRooms')
          "
        >
          <el-button
            v-if="loadError"
            text
            type="primary"
            @click="emit('retryRooms')"
          >
            {{ t("buttons.retry") }}
          </el-button>
        </ReEmpty>
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
            <div class="relative shrink-0">
              <el-avatar class="avatar-sm" :src="peer.avatar || undefined">
                {{ avatarText(peer) }}
              </el-avatar>
              <!-- 联系人在线点：与会话行同一位置同一语义 -->
              <span
                class="absolute right-0 bottom-0 size-2.5 rounded-full border border-solid border-(--el-bg-color)"
                :class="
                  peer.online
                    ? 'bg-(--el-color-success)'
                    : 'bg-(--el-color-info-light-5)'
                "
              />
            </div>
            <div class="min-w-0 grow">
              <div class="truncate text-sm">
                {{ peer.nickname || peer.username }}
              </div>
              <div class="text-xs text-(--el-text-color-secondary)">
                {{ peer.online ? t("chat.online") : t("chat.offline") }}
              </div>
            </div>
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
