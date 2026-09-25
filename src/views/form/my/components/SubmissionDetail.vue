<script lang="ts" setup>
import { computed, onMounted, reactive } from "vue";
import { useI18n } from "vue-i18n";
import {
  submissionApi,
  type FormField,
  type SubmissionItem,
  type SubmissionTrailItem
} from "@/api/system/dform";
import {
  getDictItems,
  statusTagProps,
  type DictItem,
  type StatusTagType
} from "@/utils/dict";

/**
 * 提交详情抽屉：基本信息 + 按 schema 渲染的字段明细 + 审批轨迹（时间线）。
 *
 * 字段 label 与复杂控件（选人/附件/明细子表/字典选项）都按 schema 快照渲染，
 * 填报人无需「表单设计器」权限；轨迹来自提交绑定的流程实例任务（状态口径与
 * 流程审批中心一致）。
 */
defineOptions({ name: "FormSubmissionDetail" });

const props = defineProps<{
  /** 列表行（含 form_schema / approval_trail，retrieve 与 list 同构） */
  row: SubmissionItem;
}>();

const { t } = useI18n();

const SUBMISSION_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  DRAFT: "info",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info"
};

const TRAIL_STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "info",
  PENDING: "warning"
};

const schemaFields = computed<FormField[]>(() => props.row.form_schema ?? []);
const data = computed<Record<string, unknown>>(() => props.row.data ?? {});

/** 字典选项缓存（字段 key → 字典项）：展示值时把 value 映射为 label */
const dictCache = reactive<Record<string, DictItem[]>>({});
/** 选人字段的用户名缓存（pk → username-nickname） */
const userLabels = reactive<Record<string, string>>({});

const statusOf = (value?: SubmissionItem["status"]) =>
  typeof value === "object" && value !== null ? value : undefined;

/** 字段值展示文本（复杂控件按语义拼装；明细子表单独走表格渲染） */
const displayOf = (field: FormField, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  switch (field.type) {
    case "switch":
      return value ? t("dform.yes") : t("dform.no");
    case "checkbox":
    case "daterange":
      return Array.isArray(value) ? value.join("、") : String(value);
    case "cascader":
      return Array.isArray(value) ? value.join(" / ") : String(value);
    case "user": {
      const pks = (Array.isArray(value) ? value : [value]).map(item =>
        String(item)
      );
      return pks.map(pk => userLabels[pk] ?? pk).join("、");
    }
    case "upload":
      return Array.isArray(value)
        ? value
            .map(item =>
              typeof item === "object" && item !== null
                ? String((item as { filename?: string }).filename ?? "")
                : String(item)
            )
            .filter(Boolean)
            .join("、") || "-"
        : String(value);
    case "select":
    case "radio": {
      if (!field.dict) return String(value);
      const hit = (dictCache[field.key] ?? []).find(
        item => String(item.value ?? "") === String(value)
      );
      return hit ? hit.label : String(value);
    }
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
};

/** 明细行：schema 字段（含历史 data 中未登记 key，回退原 key 展示） */
const fieldRows = computed(() => {
  const rows = schemaFields.value.map(field => ({
    key: field.key,
    label: field.label || field.key,
    field,
    value: data.value[field.key],
    isTable: field.type === "table",
    columns: field.columns ?? []
  }));
  const known = new Set(rows.map(item => item.key));
  for (const key of Object.keys(data.value)) {
    if (known.has(key)) continue;
    rows.push({
      key,
      label: key,
      field: { key, label: key, type: "input" } as FormField,
      value: data.value[key],
      isTable: false,
      columns: []
    });
  }
  return rows;
});

const tableRowsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const cellText = (column: { key: string; type?: string }, row: unknown) => {
  const value = (row as Record<string, unknown>)?.[column.key];
  if (value === null || value === undefined || value === "") return "-";
  if (column.type === "number") return String(value);
  return String(value);
};

onMounted(async () => {
  // 字典字段：拉取字典项用于 value → label 映射（接口带缓存）
  for (const field of schemaFields.value) {
    if (!field.dict) continue;
    getDictItems(field.dict).then(items => {
      dictCache[field.key] = items;
    });
  }
  // 选人字段：按主键批量回显用户名（仅在需要展示时请求，不枚举通讯录）
  const pks = new Set<number>();
  for (const field of schemaFields.value) {
    if (field.type !== "user") continue;
    const raw = data.value[field.key];
    for (const item of Array.isArray(raw) ? raw : [raw]) {
      const pk = Number(item);
      if (Number.isInteger(pk) && pk > 0) pks.add(pk);
    }
  }
  if (!pks.size) return;
  submissionApi
    .userOptions({ pks: [...pks] })
    .then(res => {
      for (const user of res?.data ?? []) {
        userLabels[String(user.pk)] = user.nickname
          ? `${user.username}-${user.nickname}`
          : user.username;
      }
    })
    .catch(() => undefined);
});

const trailTime = (item: SubmissionTrailItem) =>
  item.acted_at || item.created_time || "";
const trailStatus = (item: SubmissionTrailItem) =>
  typeof item.status === "object" && item.status !== null
    ? item.status
    : undefined;
</script>

<template>
  <div data-testid="submission-detail-drawer">
    <el-descriptions :column="2" border class="mb-3">
      <el-descriptions-item :label="t('dform.name')">
        {{ row.form_name }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('dform.status')">
        <el-tag
          v-if="statusOf(row.status)?.value"
          size="small"
          v-bind="statusTagProps(row.status, SUBMISSION_STATUS_TAG_TYPE)"
        >
          {{ statusOf(row.status)?.label }}
        </el-tag>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item :label="t('dform.submittedAt')">
        {{ row.created_time }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('dform.updatedAt')">
        {{ row.updated_time || "-" }}
      </el-descriptions-item>
      <el-descriptions-item
        v-if="row.instance"
        :label="t('dform.instanceNo')"
        :span="2"
      >
        {{ String(row.instance).slice(0, 8).toUpperCase() }}
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">
      {{ t("dform.submissionData") }}
    </el-divider>
    <el-empty
      v-if="!fieldRows.length"
      :description="t('dform.noData')"
      :image-size="60"
    />
    <el-descriptions v-else :column="1" border>
      <el-descriptions-item
        v-for="item in fieldRows"
        :key="item.key"
        :label="item.label"
      >
        <el-table
          v-if="item.isTable"
          :data="tableRowsOf(item.value)"
          size="small"
          border
        >
          <el-table-column
            v-for="column in item.columns"
            :key="column.key"
            :label="column.label"
            min-width="110"
          >
            <template #default="{ row: tableRow }">
              {{ cellText(column, tableRow) }}
            </template>
          </el-table-column>
        </el-table>
        <span v-else class="break-all">
          {{ displayOf(item.field, item.value) }}
        </span>
      </el-descriptions-item>
    </el-descriptions>

    <template v-if="(row.approval_trail ?? []).length">
      <el-divider content-position="left">
        {{ t("dform.approvalTrail") }}
      </el-divider>
      <el-timeline>
        <el-timeline-item
          v-for="item in row.approval_trail"
          :key="item.pk"
          :timestamp="trailTime(item)"
          placement="top"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ item.node_name }}</span>
            <el-tag
              v-if="trailStatus(item)?.value"
              size="small"
              v-bind="statusTagProps(item.status, TRAIL_STATUS_TAG_TYPE)"
            >
              {{ trailStatus(item)?.label }}
            </el-tag>
            <el-tag v-if="item.is_added" size="small" type="warning">
              {{ t("systemApprovalInstance.taskAdded") }}
            </el-tag>
            <span class="text-xs text-(--el-text-color-regular)">
              {{ item.actor?.label ?? item.assignee?.label ?? "-" }}
            </span>
            <el-tag
              v-if="item.delegate_from?.label"
              size="small"
              type="info"
              data-testid="trail-delegate-from"
            >
              {{
                t("systemApprovalInstance.delegatedFrom", {
                  name: item.delegate_from.label
                })
              }}
            </el-tag>
          </div>
          <div
            v-if="item.comment"
            class="mt-1 text-xs text-(--el-text-color-regular)"
            data-testid="trail-comment"
          >
            {{ item.comment }}
          </div>
        </el-timeline-item>
      </el-timeline>
    </template>
  </div>
</template>
