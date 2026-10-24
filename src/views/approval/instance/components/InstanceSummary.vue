<script lang="ts" setup>
import { useI18n } from "vue-i18n";

import type { NodeProgress } from "@/api/approval/approvalFlow";
import { statusTagProps, type StatusTagType } from "@/utils/dict";

/**
 * 实例详情基础信息区（自 InstanceDetail 拆出，控制单文件行数）：
 * 标题/流程/状态/申请人/原申请/抄送人/当前节点/提交时间/节点进度/结束说明。
 * 只做展示，数据由详情接口下发。
 */
defineOptions({ name: "InstanceSummary" });

type DictValue = { value?: string; label?: string } | string;
type RelatedUser = { pk?: string | number; label?: string };

type SummaryDetail = {
  title: string;
  flow_name: string;
  status?: DictValue;
  creator?: RelatedUser;
  current_node_name?: string;
  created_time?: string;
  reason?: string;
  cc_users?: RelatedUser[];
  source_instance?: { pk: string; label?: string } | null;
};

const props = defineProps<{
  detail: SummaryDetail;
  nodeProgress: NodeProgress | null;
  progressCount: string;
  progressHint: string;
}>();

const { t } = useI18n();

const FLOW_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info",
  PENDING: "warning"
};

const statusOf = (value?: DictValue) =>
  typeof value === "object" && value !== null ? value : undefined;
</script>

<template>
  <el-descriptions :column="2" border class="mb-3">
    <el-descriptions-item :label="t('systemApprovalInstance.formTitle')">
      {{ props.detail.title }}
    </el-descriptions-item>
    <el-descriptions-item :label="t('systemApprovalInstance.formFlow')">
      {{ props.detail.flow_name }}
    </el-descriptions-item>
    <el-descriptions-item :label="t('systemApprovalInstance.formStatus')">
      <el-tag
        v-bind="statusTagProps(props.detail.status, FLOW_STATUS_TAG_TYPE)"
        :key="
          String(statusOf(props.detail.status)?.value ?? props.detail.status)
        "
      >
        {{
          statusOf(props.detail.status)?.label ??
          t(
            `systemApprovalInstance.status${statusOf(props.detail.status)?.value}`
          )
        }}
      </el-tag>
    </el-descriptions-item>
    <el-descriptions-item :label="t('systemApprovalInstance.formApplicant')">
      {{ props.detail.creator?.label ?? "-" }}
    </el-descriptions-item>
    <el-descriptions-item
      v-if="props.detail.source_instance"
      :label="t('systemApprovalInstance.sourceInstance')"
    >
      <span data-testid="instance-source">
        {{
          props.detail.source_instance.label || props.detail.source_instance.pk
        }}
      </span>
    </el-descriptions-item>
    <el-descriptions-item
      v-if="props.detail.cc_users?.length"
      :label="t('systemApprovalInstance.formCcUsers')"
      :span="2"
    >
      <div class="flex flex-wrap gap-1" data-testid="instance-cc-users">
        <el-tag
          v-for="user in props.detail.cc_users"
          :key="user.pk"
          size="small"
          effect="plain"
        >
          {{ user.label }}
        </el-tag>
      </div>
    </el-descriptions-item>
    <el-descriptions-item :label="t('systemApprovalInstance.formCurrentNode')">
      {{ props.detail.current_node_name || "-" }}
    </el-descriptions-item>
    <el-descriptions-item :label="t('systemApprovalInstance.formCreatedTime')">
      {{ props.detail.created_time ?? "-" }}
    </el-descriptions-item>
    <el-descriptions-item
      v-if="props.nodeProgress"
      :label="t('systemApprovalInstance.nodeProgress')"
      :span="2"
    >
      <div class="flex items-center gap-2">
        <el-tag
          :type="props.nodeProgress.reached ? 'success' : 'warning'"
          size="small"
          data-testid="node-progress-tag"
        >
          {{ props.progressCount }}
        </el-tag>
        <span
          class="text-(length:--font-size-sm) text-(--el-text-color-regular)"
          >{{ props.progressHint }}</span
        >
      </div>
    </el-descriptions-item>
    <el-descriptions-item
      v-if="props.detail.reason"
      :label="t('systemApprovalInstance.formReason')"
      :span="2"
    >
      {{ props.detail.reason }}
    </el-descriptions-item>
  </el-descriptions>
</template>
