<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { approvalFlowApi } from "@/api/system/approvalFlow";

/**
 * 流程定义配置抽屉（ADR-012 一期：列表式节点编辑，不做拖拽画布）。
 *
 * 三段式：基本信息 / 表单字段（发起申请时的动态表单）/ 审批节点（顺序 + 或签会签 +
 * 审批人解析 + 节点条件 + 超时小时）；保存时整体提交（节点列表替换式更新）。
 */

defineOptions({ name: "ApprovalFlowConfig" });

type ApiNode = {
  name: string;
  order: number;
  approve_type?: string;
  assignee_type?: string;
  assignee_value?: string;
  condition?: { field?: string; op?: string; value?: unknown } | null;
  timeout_hours?: number;
};
type FlowRow = {
  pk: string;
  name: string;
  code: string;
  is_active: boolean;
  form_schema?: Array<{
    key: string;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
  }>;
  nodes?: ApiNode[];
};
type NodeRow = {
  name: string;
  approve_type: string;
  assignee_type: string;
  assignee_value: string;
  condition_field: string;
  condition_op: string;
  condition_value: string;
  timeout_hours: number;
};
type FieldRow = {
  label: string;
  key: string;
  type: string;
  required: boolean;
  options: string;
};

const props = defineProps<{
  flow?: FlowRow | null;
  onSaved?: () => void;
  onClose?: () => void;
}>();

const { t } = useI18n();
const saving = ref(false);

const basic = reactive({ name: "", code: "", is_active: true });
const nodes = ref<NodeRow[]>([]);
const fields = ref<FieldRow[]>([]);

const ASSIGNEE_TYPES = ["role", "user", "leader", "field"];
const CONDITION_OPS = [
  "eq",
  "ne",
  "in",
  "not_in",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "is_empty",
  "not_empty"
];
const FIELD_TYPES = ["text", "textarea", "number", "date", "select"];

/**
 * 取选项类字段的原始值：接口把 choices 序列化为 {value,label}（LabeledChoiceField），
 * 下拉框需要的是标量 value（保存时同样提交标量，服务端两种形态都收）。
 */
function pickValue(raw: unknown, fallback: string): string {
  if (
    raw &&
    typeof raw === "object" &&
    "value" in (raw as Record<string, unknown>)
  ) {
    const value = (raw as { value?: unknown }).value;
    return value === undefined || value === null ? fallback : String(value);
  }
  return raw ? String(raw) : fallback;
}

/** 条件值回显：数组拼接为逗号分隔文本（保存时按运算符反向解析） */
function formatConditionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? value.join(",") : String(value);
}

/** 条件值提交：in/not_in 拆数组；比较运算符转数值（失败保留原串） */
function parseConditionValue(op: string, raw: string): unknown {
  const text = raw.trim();
  if (op === "in" || op === "not_in") {
    return text
      ? text
          .split(",")
          .map(item => item.trim())
          .filter(Boolean)
      : [];
  }
  if (["gt", "gte", "lt", "lte"].includes(op) && text !== "") {
    const num = Number(text);
    return Number.isNaN(num) ? text : num;
  }
  return text;
}

function addNode() {
  nodes.value.push({
    name: "",
    approve_type: "OR",
    assignee_type: "role",
    assignee_value: "",
    condition_field: "",
    condition_op: "eq",
    condition_value: "",
    timeout_hours: 0
  });
}

function removeNode(index: number) {
  nodes.value.splice(index, 1);
}

function moveNode(index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= nodes.value.length) return;
  const list = nodes.value;
  [list[index], list[target]] = [list[target], list[index]];
}

function addField() {
  fields.value.push({
    label: "",
    key: "",
    type: "text",
    required: false,
    options: ""
  });
}

function removeField(index: number) {
  fields.value.splice(index, 1);
}

function initFromFlow() {
  const flow = props.flow;
  basic.name = flow?.name ?? "";
  basic.code = flow?.code ?? "";
  basic.is_active = flow?.is_active ?? true;
  fields.value = (flow?.form_schema ?? []).map(item => ({
    label: item.label ?? "",
    key: item.key,
    type: item.type ?? "text",
    required: !!item.required,
    options: (item.options ?? []).join(",")
  }));
  nodes.value = (flow?.nodes ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(node => ({
      name: node.name ?? "",
      approve_type: pickValue(node.approve_type, "OR"),
      assignee_type: pickValue(node.assignee_type, "role"),
      assignee_value: node.assignee_value ?? "",
      condition_field: node.condition?.field ?? "",
      condition_op: node.condition?.op ?? "eq",
      condition_value: formatConditionValue(node.condition?.value),
      timeout_hours: node.timeout_hours ?? 0
    }));
  if (!nodes.value.length) addNode();
}

async function save() {
  if (!basic.name.trim() || !basic.code.trim()) {
    ElMessage.error(t("systemApprovalFlow.nameAndCodeRequired"));
    return;
  }
  if (!nodes.value.length) {
    ElMessage.error(t("systemApprovalFlow.nodeRequired"));
    return;
  }
  const emptyNode = nodes.value.find(node => !node.name.trim());
  if (emptyNode) {
    ElMessage.error(t("systemApprovalFlow.nodeNameRequired"));
    return;
  }
  const payload = {
    name: basic.name.trim(),
    code: basic.code.trim(),
    is_active: basic.is_active,
    form_schema: fields.value
      .filter(field => field.key.trim())
      .map(field => ({
        key: field.key.trim(),
        label: field.label.trim() || field.key.trim(),
        type: field.type,
        required: field.required,
        options:
          field.type === "select"
            ? field.options
                .split(",")
                .map(item => item.trim())
                .filter(Boolean)
            : []
      })),
    nodes: nodes.value.map((node, index) => ({
      name: node.name.trim(),
      order: index + 1,
      approve_type: node.approve_type,
      assignee_type: node.assignee_type,
      assignee_value: node.assignee_value.trim(),
      condition: node.condition_field.trim()
        ? {
            field: node.condition_field.trim(),
            op: node.condition_op,
            value: parseConditionValue(node.condition_op, node.condition_value)
          }
        : {},
      timeout_hours: Number(node.timeout_hours) || 0
    }))
  };
  saving.value = true;
  try {
    const res = props.flow?.pk
      ? await approvalFlowApi.partialUpdate(props.flow.pk, payload)
      : await approvalFlowApi.create(payload);
    if (res.code === 1000) {
      ElMessage.success(t("systemApprovalFlow.saveSuccess"));
      props.onSaved?.();
      props.onClose?.();
    }
  } catch {
    // 失败提示（含「有在途申请不可改节点」等业务错误）由 http 拦截器统一处理
  } finally {
    saving.value = false;
  }
}

onMounted(initFromFlow);
</script>
<template>
  <div class="flow-config">
    <el-form :model="basic" label-width="90px">
      <el-form-item :label="t('systemApprovalFlow.formName')" required>
        <el-input v-model="basic.name" maxlength="64" />
      </el-form-item>
      <el-form-item :label="t('systemApprovalFlow.formCode')" required>
        <el-input v-model="basic.code" maxlength="64" :disabled="!!flow?.pk" />
      </el-form-item>
      <el-form-item :label="t('systemApprovalFlow.formActive')">
        <el-switch v-model="basic.is_active" />
      </el-form-item>
    </el-form>

    <el-divider content-position="left">
      {{ t("systemApprovalFlow.formSchemaTitle") }}
    </el-divider>
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.formSchemaTip')"
      class="mb-2"
    />
    <el-table :data="fields" size="small" border>
      <el-table-column :label="t('systemApprovalFlow.fieldLabel')" width="150">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.fieldKey')" width="150">
        <template #default="{ row }">
          <el-input v-model="row.key" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.fieldType')" width="130">
        <template #default="{ row }">
          <el-select v-model="row.type" size="small">
            <el-option
              v-for="type in FIELD_TYPES"
              :key="type"
              :label="type"
              :value="type"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.fieldRequired')"
        width="90"
      >
        <template #default="{ row }">
          <el-switch v-model="row.required" />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.fieldOptions')"
        min-width="160"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.options"
            size="small"
            :disabled="row.type !== 'select'"
            :placeholder="t('systemApprovalFlow.fieldOptionsTip')"
          />
        </template>
      </el-table-column>
      <el-table-column width="80" align="center">
        <template #header>
          <el-button link type="primary" size="small" @click="addField">
            {{ t("systemApprovalFlow.addField") }}
          </el-button>
        </template>
        <template #default="{ $index }">
          <el-button
            link
            type="danger"
            size="small"
            @click="removeField($index)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-divider content-position="left">
      {{ t("systemApprovalFlow.nodesTitle") }}
    </el-divider>
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.nodesTip')"
      class="mb-2"
    />
    <el-table :data="nodes" size="small" border class="nodes-table">
      <el-table-column
        type="index"
        width="50"
        :label="t('systemApprovalFlow.nodeOrder')"
      />
      <el-table-column :label="t('systemApprovalFlow.nodeName')" width="140">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.approveType')" width="110">
        <template #default="{ row }">
          <el-select v-model="row.approve_type" size="small">
            <el-option
              :label="t('systemApprovalFlow.approveTypeOR')"
              value="OR"
            />
            <el-option
              :label="t('systemApprovalFlow.approveTypeAND')"
              value="AND"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.assigneeType')"
        width="130"
      >
        <template #default="{ row }">
          <el-select v-model="row.assignee_type" size="small">
            <el-option
              v-for="type in ASSIGNEE_TYPES"
              :key="type"
              :label="t(`systemApprovalFlow.assigneeType_${type}`)"
              :value="type"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.assigneeValue')"
        min-width="150"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.assignee_value"
            size="small"
            :disabled="row.assignee_type === 'leader'"
            :placeholder="
              t(`systemApprovalFlow.assigneeHint_${row.assignee_type}`)
            "
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.conditionField')"
        width="120"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.condition_field"
            size="small"
            :placeholder="t('systemApprovalFlow.conditionFieldTip')"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.conditionOp')" width="120">
        <template #default="{ row }">
          <el-select
            v-model="row.condition_op"
            size="small"
            :disabled="!row.condition_field"
          >
            <el-option
              v-for="op in CONDITION_OPS"
              :key="op"
              :label="op"
              :value="op"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.conditionValue')"
        width="120"
      >
        <template #default="{ row }">
          <el-input
            v-model="row.condition_value"
            size="small"
            :disabled="
              !row.condition_field ||
              ['is_empty', 'not_empty'].includes(row.condition_op)
            "
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.timeoutHours')"
        width="110"
      >
        <template #default="{ row }">
          <el-input-number
            v-model="row.timeout_hours"
            size="small"
            :min="0"
            controls-position="right"
          />
        </template>
      </el-table-column>
      <el-table-column width="150" align="center">
        <template #header>
          <el-button link type="primary" size="small" @click="addNode">
            {{ t("systemApprovalFlow.addNode") }}
          </el-button>
        </template>
        <template #default="{ $index }">
          <el-button
            link
            size="small"
            :disabled="$index === 0"
            @click="moveNode($index, -1)"
          >
            ↑
          </el-button>
          <el-button
            link
            size="small"
            :disabled="$index === nodes.length - 1"
            @click="moveNode($index, 1)"
          >
            ↓
          </el-button>
          <el-button
            link
            type="danger"
            size="small"
            @click="removeNode($index)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex justify-end mt-4">
      <el-button @click="props.onClose?.()">{{
        t("buttons.cancel")
      }}</el-button>
      <el-button type="primary" :loading="saving" @click="save">
        {{ t("buttons.save") }}
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nodes-table {
  :deep(.el-input-number) {
    width: 100%;
  }
}
</style>
