<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
import type { InstanceComment, NodeProgress } from "@/api/system/approvalFlow";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { statusTagProps, type StatusTagType } from "@/utils/dict";

/**
 * 流程实例详情抽屉：基本信息 + 表单数据（按 form_schema 渲染 label）+ 审批轨迹。
 * 只读展示，不提供操作（操作在列表行内按钮完成）。
 */

defineOptions({ name: "SystemApprovalInstanceDetail" });

type DictValue = { value?: string; label?: string; color?: string } | string;
type RelatedUser = { pk?: number | string; label?: string };
type TaskRow = {
  pk: string;
  node_name: string;
  node_order: number;
  assignee?: RelatedUser;
  /** 处理人显示名快照：用户删除/改名后轨迹仍可读 */
  assignee_display?: string;
  /** 委托代审来源：assignee 为代理人时记录的原审批人 */
  delegate_from?: RelatedUser;
  actor?: RelatedUser;
  actor_display?: string;
  status?: DictValue;
  comment?: string;
  acted_at?: string;
  created_time?: string;
  is_added?: boolean;
};
type RelatedObject = {
  type?: string;
  label?: string;
  title?: string;
  status?: string;
  fields?: Array<{ label?: string; value?: string }>;
  missing?: boolean;
};
type FormField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
};
type InstanceDetailData = {
  pk: string;
  title: string;
  flow_name: string;
  status?: DictValue;
  creator?: RelatedUser;
  current_node_name?: string;
  /** 当前节点进度（比例会签达标线预览；非审批中实例为 null） */
  node_progress?: NodeProgress | null;
  reason?: string;
  finished_at?: string;
  created_time?: string;
  form_data?: Record<string, unknown>;
  form_schema?: FormField[];
  tasks?: TaskRow[];
  /** 关联业务对象当前状态（白名单渲染；无关联为 null） */
  related_object?: RelatedObject | null;
};

const FLOW_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info",
  PENDING: "warning"
};

const props = defineProps<{ pk: string | number }>();
const { t } = useI18n();

const loading = ref(true);
const detail = ref<InstanceDetailData | null>(null);

/** 表单数据行：按 form_schema 的 label 渲染（未登记的 key 回退原 key） */
const formRows = computed(() => {
  const data = detail.value?.form_data ?? {};
  const labels = new Map(
    (detail.value?.form_schema ?? []).map(item => [
      item.key,
      item.label || item.key
    ])
  );
  return Object.entries(data).map(([key, value]) => ({
    key,
    label: labels.get(key) ?? key,
    value:
      value === null || value === undefined || value === ""
        ? "-"
        : Array.isArray(value)
          ? value.join(", ")
          : String(value)
  }));
});

async function load() {
  try {
    const res = await approvalInstanceApi.retrieve(props.pk);
    detail.value = (res.data ?? null) as InstanceDetailData | null;
  } finally {
    loading.value = false;
  }
}

/** 讨论区：参与人（申请人 / 处理人 / 抄送人）可评论，@用户名 会提醒相关人 */
const comments = ref<InstanceComment[]>([]);
const commentText = ref("");
const commentLoading = ref(false);

async function loadComments() {
  try {
    const res = await approvalInstanceApi.comments(props.pk);
    if (res.code === SUCCESS_CODE) {
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
    const res = await approvalInstanceApi.addComment(props.pk, content);
    if (res.code === SUCCESS_CODE) {
      message(t("approvalDiscussion.submitted"), { type: "success" });
      commentText.value = "";
      await loadComments();
    } else {
      message(String(res.detail), { type: "warning" });
    }
  } catch (error: unknown) {
    message(String((error as Error)?.message ?? error), { type: "warning" });
  } finally {
    commentLoading.value = false;
  }
}

async function removeComment(item: InstanceComment) {
  try {
    await ElMessageBox.confirm(
      t("approvalDiscussion.deleteConfirm"),
      t("buttons.tips"),
      {
        type: "warning",
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel")
      }
    );
  } catch {
    return;
  }
  const res = await approvalInstanceApi.deleteComment(props.pk, item.pk);
  if (res.code === SUCCESS_CODE) {
    await loadComments();
  } else {
    message(String(res.detail), { type: "warning" });
  }
}

/** 评论时间展示（ISO → yyyy-MM-dd HH:mm:ss） */
const commentTime = (value?: string) =>
  value ? String(value).replace("T", " ").slice(0, 19) : "-";

const statusOf = (value?: DictValue) =>
  typeof value === "object" && value !== null ? value : undefined;

/** 关联业务对象：无关联 / 未接入白名单时为 null（不渲染卡片） */
const related = computed(() => detail.value?.related_object ?? null);

/** 处理人展示：显示名快照优先（用户删除/改名后不丢痕迹），回落实时 label */
const handlerText = (task: TaskRow) =>
  task.actor_display ||
  task.actor?.label ||
  task.assignee_display ||
  task.assignee?.label ||
  "-";

/** 节点进度（比例会签达标线预览）：审批中且有当前节点时由服务端下发 */
const nodeProgress = computed(() => detail.value?.node_progress ?? null);
/** 进度计数文案：已通过 X / 需 Y 人（候选 Z） */
const progressCount = computed(() => {
  const progress = nodeProgress.value;
  if (!progress) return "";
  return t("systemApprovalInstance.progressCount", {
    approved: progress.approved,
    required: progress.required,
    total: progress.total
  });
});
/** 审批类型提示：比例会签给达标线，或签/会签给规则说明 */
const progressHint = computed(() => {
  const progress = nodeProgress.value;
  if (!progress) return "";
  if (progress.approve_type === "RATIO") {
    return t("systemApprovalInstance.progressRatioHint", {
      ratio: progress.approve_ratio
    });
  }
  return progress.approve_type === "OR"
    ? t("systemApprovalInstance.progressOrHint")
    : t("systemApprovalInstance.progressAndHint");
});

onMounted(() => {
  void load();
  void loadComments();
});
</script>
<template>
  <div v-loading="loading">
    <template v-if="detail">
      <el-descriptions :column="2" border class="mb-3">
        <el-descriptions-item :label="t('systemApprovalInstance.formTitle')">
          {{ detail.title }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('systemApprovalInstance.formFlow')">
          {{ detail.flow_name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('systemApprovalInstance.formStatus')">
          <el-tag
            v-bind="statusTagProps(detail.status, FLOW_STATUS_TAG_TYPE)"
            :key="String(statusOf(detail.status)?.value ?? detail.status)"
          >
            {{
              statusOf(detail.status)?.label ??
              t(
                `systemApprovalInstance.status${statusOf(detail.status)?.value}`
              )
            }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('systemApprovalInstance.formApplicant')"
        >
          {{ detail.creator?.label ?? "-" }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('systemApprovalInstance.formCurrentNode')"
        >
          {{ detail.current_node_name || "-" }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="t('systemApprovalInstance.formCreatedTime')"
        >
          {{ detail.created_time ?? "-" }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="nodeProgress"
          :label="t('systemApprovalInstance.nodeProgress')"
          :span="2"
        >
          <div class="flex items-center gap-2">
            <el-tag
              :type="nodeProgress.reached ? 'success' : 'warning'"
              size="small"
              data-testid="node-progress-tag"
            >
              {{ progressCount }}
            </el-tag>
            <span class="text-[13px] text-(--el-text-color-regular)">{{
              progressHint
            }}</span>
          </div>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="detail.reason"
          :label="t('systemApprovalInstance.formReason')"
          :span="2"
        >
          {{ detail.reason }}
        </el-descriptions-item>
      </el-descriptions>

      <template v-if="related">
        <el-divider content-position="left">
          {{ t("systemApprovalInstance.relatedObject") }}
        </el-divider>
        <el-descriptions
          :column="2"
          border
          class="mb-3"
          data-testid="instance-related-object"
        >
          <el-descriptions-item
            :label="t('systemApprovalInstance.relatedType')"
          >
            {{ related.label || related.type || "-" }}
          </el-descriptions-item>
          <el-descriptions-item
            :label="t('systemApprovalInstance.relatedTitle')"
          >
            {{
              related.missing
                ? t("systemApprovalInstance.relatedMissing")
                : related.title || "-"
            }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="related.status"
            :label="t('systemApprovalInstance.relatedStatus')"
          >
            {{ related.status }}
          </el-descriptions-item>
          <el-descriptions-item
            v-for="row in related.fields ?? []"
            :key="row.label"
            :label="row.label"
          >
            {{ row.value || "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>

      <el-divider content-position="left">
        {{ t("systemApprovalInstance.formData") }}
      </el-divider>
      <ReEmpty
        v-if="!formRows.length"
        :description="t('systemApprovalInstance.formDataEmpty')"
        :image-size="60"
      />
      <el-descriptions v-else :column="1" border>
        <el-descriptions-item
          v-for="row in formRows"
          :key="row.key"
          :label="row.label"
        >
          {{ row.value }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">
        {{ t("systemApprovalInstance.tasks") }}
      </el-divider>
      <ReEmpty
        v-if="!(detail.tasks ?? []).length"
        :description="t('systemApprovalInstance.tasksEmpty')"
        :image-size="60"
      />
      <!-- 流转记录时间线：每个节点任务一行（处理人/状态/意见/加签/代理来源） -->
      <el-timeline v-else data-testid="instance-trail">
        <el-timeline-item
          v-for="task in detail.tasks"
          :key="task.pk"
          :timestamp="task.acted_at || task.created_time || ''"
          placement="top"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ task.node_name }}</span>
            <el-tag
              v-if="statusOf(task.status)?.value"
              size="small"
              v-bind="statusTagProps(task.status, FLOW_STATUS_TAG_TYPE)"
            >
              {{
                statusOf(task.status)?.label ??
                t(
                  `systemApprovalInstance.status${statusOf(task.status)?.value}`
                )
              }}
            </el-tag>
            <el-tag v-if="task.is_added" size="small" type="warning">
              {{ t("systemApprovalInstance.taskAdded") }}
            </el-tag>
            <span class="text-xs text-(--el-text-color-regular)">
              {{ handlerText(task) }}
            </span>
            <el-tag
              v-if="task.delegate_from?.label"
              size="small"
              type="info"
              data-testid="trail-delegate-from"
            >
              {{
                t("systemApprovalInstance.delegatedFrom", {
                  name: task.delegate_from.label
                })
              }}
            </el-tag>
          </div>
          <div
            v-if="task.comment"
            class="mt-1 text-xs text-(--el-text-color-regular)"
            data-testid="trail-comment"
          >
            {{ task.comment }}
          </div>
        </el-timeline-item>
      </el-timeline>
    </template>

    <!-- 讨论区：与审批轨迹同页，评论支持 @用户名 提醒 -->
    <el-divider content-position="left">
      {{ t("approvalDiscussion.title") }}
    </el-divider>
    <div data-testid="instance-comments">
      <div v-if="comments.length">
        <div
          v-for="item in comments"
          :key="item.pk"
          class="mb-2 rounded bg-gray-50 p-2 dark:bg-gray-800"
        >
          <div class="flex-bc text-xs text-(--el-text-color-regular)">
            <span>
              {{ item.author_display || "-" }} ·
              {{ commentTime(item.created_time) }}
            </span>
            <el-button
              link
              type="danger"
              size="small"
              @click="removeComment(item)"
            >
              {{ t("buttons.delete") }}
            </el-button>
          </div>
          <div class="mt-1 text-sm whitespace-pre-wrap">{{ item.content }}</div>
        </div>
      </div>
      <div v-else class="mb-2 text-xs text-(--el-text-color-secondary)">
        {{ t("approvalDiscussion.empty") }}
      </div>
      <el-input
        v-model="commentText"
        type="textarea"
        :rows="3"
        maxlength="2000"
        show-word-limit
        :placeholder="t('approvalDiscussion.placeholder')"
      />
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
    </div>
  </div>
</template>
