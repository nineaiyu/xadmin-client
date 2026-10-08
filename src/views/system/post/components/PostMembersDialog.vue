<script lang="ts" setup>
import { onMounted, ref } from "vue";
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
import MemberTagEditor from "@/views/system/components/MemberTagEditor.vue";

/**
 * 岗位成员分配（ReDialog 内容组件）：成员编辑交给 MemberTagEditor，
 * 本组件只做成员加载、搜索适配、只读透传与载荷注册。
 *
 * 提交走增量载荷 `{add, remove}`（服务端幂等）：不提供整体替换，避免漏传即清空。
 * 只读模式（仅持 members 只读权限）下由编辑器隐藏编辑入口、恒返回空载荷。
 */
defineOptions({ name: "PostMembersDialog" });

const props = defineProps<{
  row: PostItem;
  /** 只读模式（仅持 members 只读权限）：仅展示成员清单，隐藏编辑入口 */
  readonly?: boolean;
}>();

const { t } = useI18n();

const { loading, runWithLoading } = usePageLoading();
const members = ref<PostMemberItem[]>([]);
const editorRef = ref<InstanceType<typeof MemberTagEditor>>();

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

/** 远程搜索候选（≤20 条；无关键字时服务端返回空列表，需要输入才会出候选） */
async function searchUsers(keyword: string) {
  const res = await postApi.userOptions(keyword ?? "");
  return res.code === SUCCESS_CODE
    ? ((res.data ?? []) as PostUserOption[])
    : [];
}

const getPayload = (): Record<string, unknown> | null =>
  editorRef.value?.getPayload() ?? null;

onMounted(loadMembers);

defineExpose({ getPayload });
</script>

<template>
  <MemberTagEditor
    ref="editorRef"
    :loading="loading"
    :readonly="readonly"
    :members="members"
    :hint="readonly ? t('post.memberReadonlyHint') : t('post.memberHint')"
    :empty-text="t('post.memberEmpty')"
    :placeholder="t('post.memberPlaceholder')"
    testid="post-member-select"
    :no-change-text="t('post.memberNoChange')"
    :search="searchUsers"
  />
</template>
