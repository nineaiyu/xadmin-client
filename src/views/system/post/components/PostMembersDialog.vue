<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import { usePageLoading } from "@/hooks/usePageLoading";
import {
  postApi,
  type PostItem,
  type PostMemberItem,
  type PostUserOption
} from "@/api/system/post";

/**
 * 岗位成员分配（ReDialog 内容组件）：现有成员以标签展示（可移除）+ 远程搜索添加。
 *
 * 提交走增量载荷 `{add, remove}`（服务端幂等）：不提供整体替换，避免漏传即清空。
 */
defineOptions({ name: "PostMembersDialog" });

const props = defineProps<{
  row: PostItem;
}>();

const { t } = useI18n();

const { loading, runWithLoading } = usePageLoading();
const members = ref<PostMemberItem[]>([]);
/** 待新增（尚未提交，去重由服务端幂等兜底） */
const adding = ref<PostUserOption[]>([]);
/** 待移除的成员 pk */
const removing = ref<number[]>([]);
const options = ref<PostUserOption[]>([]);
const searching = ref(false);

const displayMembers = computed(() =>
  members.value.filter(item => !removing.value.includes(item.pk))
);

/** 成员加载失败就地提示（明细弹窗无骨架错误态），不外抛 */
async function loadMembers() {
  await runWithLoading(async () => {
    try {
      const res = await postApi.members(props.row.pk);
      if (res.code === SUCCESS_CODE) {
        members.value = res.data?.members ?? [];
      } else if (res.detail) {
        message(String(res.detail), { type: "warning" });
      }
    } catch (error) {
      const detail = (error as { detail?: string })?.detail;
      if (detail) message(String(detail), { type: "warning" });
    }
  });
}

/** 远程搜索候选（≤20 条；服务端在无关键字时返回空列表，需要输入才会出候选） */
async function searchUsers(keyword: string) {
  searching.value = true;
  try {
    const res = await postApi.userOptions(keyword ?? "");
    if (res.code === SUCCESS_CODE) {
      options.value = (res.data ?? []) as PostUserOption[];
    }
  } catch {
    options.value = [];
  } finally {
    searching.value = false;
  }
}

function markRemove(pk: number) {
  removing.value = [...removing.value, pk];
}

/** 校验并生成提交载荷；无变更返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  const existing = new Set(members.value.map(item => item.pk));
  const add = adding.value
    .map(item => item.pk)
    .filter(pk => !existing.has(pk) || removing.value.includes(pk));
  const remove = [...removing.value];
  if (!add.length && !remove.length) {
    message(t("post.memberNoChange"), { type: "warning" });
    return null;
  }
  return { add, remove };
};

onMounted(() => {
  loadMembers();
});

defineExpose({ getPayload });
</script>

<template>
  <div v-loading="loading">
    <div class="mb-2 text-sm text-(--el-text-color-secondary)">
      {{ t("post.memberHint") }}
    </div>
    <div class="mb-3 flex flex-wrap gap-1">
      <el-tag
        v-for="item in displayMembers"
        :key="item.pk"
        closable
        size="small"
        @close="markRemove(item.pk)"
      >
        {{ item.nickname || item.username }}
      </el-tag>
      <span
        v-if="!displayMembers.length"
        class="text-xs text-(--el-text-color-secondary)"
      >
        {{ t("post.memberEmpty") }}
      </span>
    </div>
    <el-select
      v-model="adding"
      multiple
      filterable
      remote
      reserve-keyword
      :remote-method="searchUsers"
      :loading="searching"
      :placeholder="t('post.memberPlaceholder')"
      style="width: 100%"
      data-testid="post-member-select"
    >
      <el-option
        v-for="item in options"
        :key="item.pk"
        :label="item.nickname || item.username"
        :value="item"
      />
    </el-select>
  </div>
</template>
