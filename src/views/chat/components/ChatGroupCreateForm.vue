<script lang="ts" setup>
import { onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import {
  chatApi,
  type ChatGroupCreatePayload,
  type ChatUserOption
} from "@/api/chat";

/**
 * 新建群聊表单（弹层内容组件形态）。
 *
 * 由 ChatSidebar 经 `addDialog` 以类型化载荷通道打开（弹层体系统一收敛，
 * 不在模板手挂 el-dialog）：群名称 + 成员远程搜索多选；草稿变化即回写
 * `props.setData`，打开方在 `beforeSure` 用 `getData()` 取最新载荷并做提交校验。
 */
const props = defineProps<{
  /** 初始载荷（打开方预置） */
  payload?: ChatGroupCreatePayload;
  /** 回写载荷（由 ReDialog 载荷通道注入） */
  setData?: (_data: ChatGroupCreatePayload) => void;
}>();

const { t } = useI18n();

const groupName = ref(props.payload?.name ?? "");
const groupMemberPks = ref<number[]>([...(props.payload?.member_pks ?? [])]);
/** 候选成员缓存：远程搜索与已选回显共用 */
const groupOptions = ref<ChatUserOption[]>([]);
const searchingMembers = ref(false);
let memberSearchTimer: number | undefined;

/** 草稿变化即回写：打开方 `getData()` 读到的永远是当前值（含校验前的空值） */
watch(
  [groupName, groupMemberPks],
  () => {
    props.setData?.({
      name: groupName.value.trim(),
      member_pks: [...groupMemberPks.value]
    });
  },
  { deep: true, immediate: true }
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

onUnmounted(() => window.clearTimeout(memberSearchTimer));
</script>

<template>
  <el-form label-width="90px">
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
