<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import type { InstanceComment } from "@/api/approval/approvalFlow";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";
import { useConfirm } from "@/hooks/useConfirm";
import { useUserStoreHook } from "@/store/modules/user";
import { hasAuth } from "@/router/utils";
import {
  splitMentionSegments,
  useMentionSuggest,
  type MentionUser
} from "../utils/mention";

/**
 * 流程实例讨论区（自 InstanceDetail 拆分，行数门禁）：与审批轨迹同页，
 * 参与人（申请人 / 处理人 / 抄送人）可评论，@用户名 会提醒相关人。
 *
 * 读 / 发表 / 删除各有独立权限点：无读权限时提示且不请求；无发表权限时给
 * 只读说明而不是留下一个提交必 403 的输入框；删除口径与后端对齐（评论作者
 * 或平台超管）。
 *
 * @ 联想（2026-10 增量）：候选 = 父组件传入的实例参与人（后端解析对任意
 * 启用用户生效，联想只收敛提示面）；选中插入 `@username `；评论正文按
 * `@用户名` 分段高亮（文本节点直出，不走 v-html）。
 */
defineOptions({ name: "SystemApprovalInstanceDiscussion" });

const props = defineProps<{
  pk: string | number;
  /** @ 联想候选（实例参与人：申请人/处理人/抄送人，label 即 username） */
  participants?: MentionUser[];
}>();
const { t } = useI18n();
const confirm = useConfirm();
const userStore = useUserStoreHook();

const comments = ref<InstanceComment[]>([]);
/** 讨论区有独立读权限点：无权限时不请求、也不显示成「暂无评论」 */
const canViewComments = hasAuth("comments:SystemApprovalInstance");
// 发表 / 删除各有独立权限点：按钮显隐按权限位收口（后端按参与人与作者/超管复核）
const canAddComment = hasAuth("addComment:SystemApprovalInstance");
const canDeleteCommentByPerm = hasAuth("deleteComment:SystemApprovalInstance");
const commentText = ref("");
const commentLoading = ref(false);

/** 联想候选：父组件参与人里排除自己（后端解析同口径，@自己不产生提醒） */
const mentionPool = computed(() =>
  (props.participants ?? []).filter(
    peer => String(peer.pk) !== String(userStore.pk ?? "")
  )
);
const { mentionQuery, mentionCandidates, insertMention } = useMentionSuggest({
  draft: commentText,
  candidates: mentionPool
});

/**
 * 删除入口与后端 delete_comment 的放行口径对齐：评论作者或平台超管。
 * creator 为 string|number，统一转字符串比对；is_superuser 随 userinfo 下发，
 * 旧持久化副本可能缺该字段，按非超管处理（行为与仅作者可见一致）。
 */
const canDeleteComment = (item: InstanceComment) =>
  canDeleteCommentByPerm &&
  ((item.creator != null &&
    String(item.creator) === String(userStore.pk ?? "")) ||
    Boolean(userStore.is_superuser));

async function loadComments() {
  if (!canViewComments) return;
  try {
    const res = await approvalInstanceApi.comments(props.pk);
    if (isSuccess(res)) {
      comments.value = res.data ?? [];
    }
  } catch {
    // 讨论区不可用时不影响详情主体展示
  }
}

async function submitComment() {
  const content = commentText.value.trim();
  if (!content) return;
  commentLoading.value = true;
  try {
    // 异常经 normalizeError 归一为失败信封，与业务失败同走一套 code/detail 分支；
    // detail 缺失回退通用文案，避免提示里渲染出字面 "undefined"
    const res = await approvalInstanceApi
      .addComment(props.pk, content)
      .catch(normalizeError);
    if (isSuccess(res)) {
      message(t("approvalDiscussion.submitted"), { type: "success" });
      commentText.value = "";
      await loadComments();
    } else {
      message(res.detail || t("results.failed"), { type: "warning" });
    }
  } finally {
    commentLoading.value = false;
  }
}

async function removeComment(item: InstanceComment) {
  if (!(await confirm(t("approvalDiscussion.deleteConfirm")))) return;
  // http 层失败已统一提示，归一为 null 后直接收尾，避免重复弹错
  const res = await approvalInstanceApi
    .deleteComment(props.pk, item.pk)
    .catch(() => null);
  if (!res) return;
  if (isSuccess(res)) {
    await loadComments();
  } else {
    // 业务失败信封 detail 缺失时回退通用文案（不渲染字面 "undefined"）
    message(res.detail || t("results.failed"), { type: "warning" });
  }
}

/** 评论时间展示（ISO → 本地可读格式） */
const commentTime = (value?: string) => formatDateTime(value) || "-";

onMounted(loadComments);
</script>

<template>
  <el-divider content-position="left">
    {{ t("approvalDiscussion.title") }}
  </el-divider>
  <el-alert
    v-if="!canViewComments"
    type="info"
    :closable="false"
    show-icon
    :title="t('systemApprovalInstance.commentsNoPermission')"
    data-testid="instance-comments-denied"
  />
  <div v-else data-testid="instance-comments">
    <div v-if="comments.length">
      <div
        v-for="item in comments"
        :key="item.pk"
        class="mb-2 rounded bg-(--el-fill-color-light) p-2"
      >
        <div class="flex-bc text-xs text-(--el-text-color-regular)">
          <span>
            {{ item.author_display || "-" }} ·
            {{ commentTime(item.created_time) }}
          </span>
          <el-button
            v-if="canDeleteComment(item)"
            link
            type="danger"
            size="small"
            data-testid="comment-delete"
            @click="removeComment(item)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </div>
        <div
          class="mt-1 text-sm whitespace-pre-wrap"
          :data-testid="`comment-content-${item.pk}`"
        >
          <template
            v-for="(seg, i) in splitMentionSegments(item.content)"
            :key="i"
          >
            <span
              v-if="seg.mention"
              class="font-medium text-(--el-color-primary)"
            >
              {{ seg.text }}
            </span>
            <template v-else>{{ seg.text }}</template>
          </template>
        </div>
      </div>
    </div>
    <div v-else class="mb-2 text-xs text-(--el-text-color-secondary)">
      {{ t("approvalDiscussion.empty") }}
    </div>
    <template v-if="canAddComment">
      <!-- @ 联想候选：输入末尾 `@片段` 触发（与聊天室同款点击式列表）；候选为空
           但已触发时提示无匹配，避免「输入 @ 毫无反应」的静默 -->
      <div
        v-if="mentionCandidates.length"
        class="mb-2 rounded border border-solid border-(--el-border-color) p-1"
        data-testid="mention-candidates"
        :aria-label="t('approvalDiscussion.mentionTitle')"
      >
        <button
          v-for="peer in mentionCandidates"
          :key="peer.pk"
          type="button"
          class="block w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-(--el-fill-color-light)"
          :data-testid="`mention-option-${peer.username}`"
          @click="insertMention(peer)"
        >
          @{{ peer.username }}
        </button>
      </div>
      <el-input
        v-model="commentText"
        type="textarea"
        :rows="3"
        maxlength="2000"
        show-word-limit
        :placeholder="t('approvalDiscussion.placeholder')"
      />
      <div
        v-if="mentionQuery !== null && !mentionCandidates.length"
        class="text-xs text-(--el-text-color-secondary)"
        data-testid="mention-empty"
      >
        {{ t("approvalDiscussion.mentionEmpty") }}
      </div>
      <div class="mt-2 text-right">
        <el-button
          type="primary"
          size="small"
          :loading="commentLoading"
          @click="submitComment"
        >
          {{ t("approvalDiscussion.submit") }}
        </el-button>
      </div>
    </template>
    <!-- 无发表权限时给出说明，而不是留下一个提交必 403 的输入框 -->
    <div
      v-else
      class="text-xs text-(--el-text-color-secondary)"
      data-testid="comment-readonly-hint"
    >
      {{ t("approvalDiscussion.readonly") }}
    </div>
  </div>
</template>
