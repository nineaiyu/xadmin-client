<script lang="ts" setup>
import { computed, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { chatApi, type ChatUserOption } from "@/api/chat";

/**
 * 新建群聊表单（弹层内容组件形态）。
 *
 * 由 ChatSidebar 经 `addDialog` 打开（弹层体系统一收敛，不在模板手挂 el-dialog）：
 * 群名称 + 成员远程搜索多选；`getPayload()` 校验通过返回创建载荷，失败返回 null
 * （调用方保持弹层打开）。
 */
const { t } = useI18n();

const groupName = ref("");
const groupMemberPks = ref<number[]>([]);
/** 候选成员缓存：远程搜索与已选回显共用 */
const groupOptions = ref<ChatUserOption[]>([]);
const searchingMembers = ref(false);
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

/** 校验并生成创建载荷；校验失败返回 null（调用方保持弹层打开） */
const getPayload = (): { name: string; member_pks: number[] } | null => {
  if (!groupName.value.trim()) {
    message(t("chat.groupNameRequired"), { type: "warning" });
    return null;
  }
  if (!groupMemberPks.value.length) {
    message(t("chat.membersRequired"), { type: "warning" });
    return null;
  }
  return {
    name: groupName.value.trim(),
    member_pks: [...groupMemberPks.value]
  };
};

defineExpose({ getPayload, canCreateGroup });

onUnmounted(() => window.clearTimeout(memberSearchTimer));
</script>

<template>
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
</template>
