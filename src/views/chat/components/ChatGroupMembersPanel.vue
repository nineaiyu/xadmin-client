<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  chatApi,
  type ChatPeer,
  type ChatRoomItem,
  type ChatUserOption
} from "@/api/chat";

/**
 * 群成员管理面板（弹层内容组件形态）。
 *
 * 由 ChatWindow 经 `addDialog` 打开（弹层体系统一收敛，不在模板手挂 el-dialog）：
 * 挂载即拉取成员列表；群主可改名 / 增删成员，所有成员可退出群聊。
 * 变更经 `roomChanged` 同步父级会话行（名称/人数），退群经 `left` 通知父级清理选中。
 */
const props = defineProps<{ room: ChatRoomItem }>();

const emit = defineEmits<{
  roomChanged: [room: ChatRoomItem];
  left: [roomId: number];
  close: [];
}>();

const { t } = useI18n();

const membersLoading = ref(false);
const groupMemberList = ref<ChatPeer[]>([]);
const renameValue = ref("");
/** 本地基准群名：改名成功后立即更新，不依赖父级 props 回传 */
const currentName = ref("");
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
  if (!name || name === currentName.value) return;
  renaming.value = true;
  try {
    const { code, data, detail } = await chatApi.renameGroup(
      props.room.id,
      name
    );
    if (code === SUCCESS_CODE && data) {
      currentName.value = name;
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
    emit("left", room.id);
    emit("close");
  } else if (detail) {
    message(String(detail), { type: "warning" });
  }
}

onMounted(() => {
  currentName.value = props.room?.name ?? "";
  renameValue.value = currentName.value;
  loadMembers();
});

onUnmounted(() => window.clearTimeout(memberSearchTimer));
</script>

<template>
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
        :disabled="!renameValue.trim() || renameValue.trim() === currentName"
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
      class="flex items-center gap-2 border-0 border-b border-solid border-(--pure-border-color) py-1.5"
      :data-testid="`chat-group-member-${member.pk}`"
    >
      <el-avatar :size="30" :src="member.avatar || undefined" class="shrink-0">
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

    <div class="mt-4 flex justify-end gap-2">
      <el-button type="danger" plain @click="leaveGroup">
        {{ t("chat.leaveGroup") }}
      </el-button>
      <el-button @click="emit('close')">
        {{ t("buttons.close") }}
      </el-button>
    </div>
  </div>
</template>
