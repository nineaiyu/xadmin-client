<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { approvalInstanceApi } from "@/api/system/approvalFlow";
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
  actor?: RelatedUser;
  status?: DictValue;
  comment?: string;
  acted_at?: string;
  is_added?: boolean;
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
  reason?: string;
  finished_at?: string;
  created_time?: string;
  form_data?: Record<string, unknown>;
  form_schema?: FormField[];
  tasks?: TaskRow[];
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

const statusOf = (value?: DictValue) =>
  typeof value === "object" && value !== null ? value : undefined;

onMounted(load);
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
          v-if="detail.reason"
          :label="t('systemApprovalInstance.formReason')"
          :span="2"
        >
          {{ detail.reason }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">
        {{ t("systemApprovalInstance.formData") }}
      </el-divider>
      <el-empty
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
      <el-table :data="detail.tasks ?? []" size="small">
        <el-table-column
          prop="node_name"
          :label="t('systemApprovalInstance.taskNode')"
        />
        <el-table-column :label="t('systemApprovalInstance.taskAssignee')">
          <template #default="{ row }">
            {{ row.assignee?.label ?? "-" }}
            <el-tag
              v-if="row.is_added"
              size="small"
              type="warning"
              class="ml-1"
            >
              {{ t("systemApprovalInstance.taskAdded") }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('systemApprovalInstance.formStatus')">
          <template #default="{ row }">
            <el-tag v-bind="statusTagProps(row.status, FLOW_STATUS_TAG_TYPE)">
              {{
                statusOf(row.status)?.label ??
                t(`systemApprovalInstance.status${statusOf(row.status)?.value}`)
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="comment"
          :label="t('systemApprovalInstance.taskComment')"
        />
        <el-table-column
          prop="acted_at"
          :label="t('systemApprovalInstance.taskActedAt')"
          width="180"
        />
      </el-table>
    </template>
  </div>
</template>
