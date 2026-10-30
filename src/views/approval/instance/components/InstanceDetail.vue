<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import ReStateContainer from "@/components/ReStateContainer";
import InstanceSummary from "./InstanceSummary.vue";
import InstanceDiscussion from "./InstanceDiscussion.vue";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/approval/approvalFlow";
import type { NodeProgress } from "@/api/approval/approvalFlow";
import { isSuccess } from "@/api/types";
import { statusTagProps, type StatusTagType } from "@/utils/dict";

/**
 * 流程实例详情抽屉：基本信息 + 表单数据（按 form_schema 渲染 label）+ 审批轨迹
 * + 讨论区（见 InstanceDiscussion，行数门禁拆分）。
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
  /** 抄送人（详情专属；列表不下发） */
  cc_users?: RelatedUser[];
  /** 驳回重提的原单（不存在/跨流程/非本人时为 null） */
  source_instance?: { pk: string; label?: string } | null;
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

const loadError = ref("");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    // http 层失败已统一提示；这里再把失败转成可见的错误态 + 重试入口，
    // 避免详情缺失时只剩一个空白抽屉（用户无法判断是加载中还是失败）。
    const res = await approvalInstanceApi.retrieve(props.pk).catch(() => null);
    if (res && isSuccess(res) && res.data) {
      detail.value = res.data as InstanceDetailData;
    } else {
      detail.value = null;
      loadError.value = String(res?.detail || t("results.failed"));
    }
  } finally {
    loading.value = false;
  }
}

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

/**
 * 讨论区 @ 联想候选（实例参与人）：申请人 + 各节点处理人/代理人/实际处理者 +
 * 抄送人，按 pk 去重。label 即 username（DisplayRelatedField 的 label_builder
 * 口径）；后端解析对任意启用用户生效，这里只收敛「联想提示面」，不构成限制。
 */
const discussionParticipants = computed(() => {
  const data = detail.value;
  if (!data) return [];
  const pool = new Map<string, { pk: string; username: string }>();
  const add = (user?: { pk?: number | string; label?: string }) => {
    if (user?.pk == null || !user.label) return;
    pool.set(String(user.pk), { pk: String(user.pk), username: user.label });
  };
  add(data.creator);
  (data.tasks ?? []).forEach(task => {
    add(task.assignee);
    add(task.delegate_from);
    add(task.actor);
  });
  (data.cc_users ?? []).forEach(add);
  return [...pool.values()];
});

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
});
</script>
<template>
  <div v-loading="loading">
    <template v-if="detail">
      <InstanceSummary
        :detail="detail"
        :node-progress="nodeProgress"
        :progress-count="progressCount"
        :progress-hint="progressHint"
      />

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
    <ReStateContainer
      v-else-if="loadError"
      state="error"
      :error-text="t('reState.error')"
      :error-detail="loadError"
    >
      <template #error>
        <el-alert
          type="error"
          :closable="false"
          show-icon
          :title="t('reState.error')"
          :description="loadError"
        />
        <div class="mt-3 text-center">
          <el-button type="primary" data-testid="instance-retry" @click="load">
            {{ t("buttons.reload") }}
          </el-button>
        </div>
      </template>
    </ReStateContainer>
    <ReEmpty v-else-if="!loading" :description="t('reState.empty')" />

    <!-- 讨论区：权限口径与评论链路见 InstanceDiscussion（行数门禁拆分） -->
    <InstanceDiscussion :pk="pk" :participants="discussionParticipants" />
  </div>
</template>
