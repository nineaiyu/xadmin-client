<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElRadioButton, ElRadioGroup } from "element-plus";
import { approvalFlowApi } from "@/api/system/approvalFlow";
import {
  buildFlowPayload,
  createEmptyNode,
  formatConditionValue,
  pickValue,
  validateFlowConfig,
  type FieldRow,
  type FlowRow,
  type NodeRow
} from "./flowConfig";
import FlowFieldsEditor from "./FlowFieldsEditor.vue";
import FlowNodesEditor from "./FlowNodesEditor.vue";
import FlowCanvas from "./FlowCanvas.vue";

/**
 * 流程定义配置抽屉（ADR-012 一期：列表式节点编辑，不做拖拽画布）。
 *
 * 三段式：基本信息 / 表单字段（发起申请时的动态表单）/ 审批节点（顺序 + 或签会签 +
 * 审批人解析 + 节点条件 + 超时小时）；保存时整体提交（节点列表替换式更新）。
 * 拆分：纯逻辑见 flowConfig.ts，字段/节点编辑表格见 FlowFieldsEditor/FlowNodesEditor。
 */

defineOptions({ name: "ApprovalFlowConfig" });

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
const canvasRef = ref<{ syncLayout: () => void } | null>(null);
// 节点编辑模式：列表（顺序编辑） / 画布（分支可视化 + 布局拖拽），二者共享同一 nodes
const editMode = ref<"list" | "canvas">("list");

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
      approve_ratio: node.approve_ratio ?? 100,
      assignee_type: pickValue(node.assignee_type, "role"),
      assignee_value: node.assignee_value ?? "",
      condition_field: node.condition?.field ?? "",
      condition_op: node.condition?.op ?? "eq",
      condition_value: formatConditionValue(node.condition?.value),
      routes: (node.routes ?? []).map(route => ({
        condition: {
          field: route.condition?.field ?? "",
          op: route.condition?.op ?? "eq",
          value: route.condition?.value ?? ""
        },
        target: Number(route.target)
      })),
      layout: { ...(node.layout ?? {}) },
      timeout_hours: node.timeout_hours ?? 0
    }));
  if (!nodes.value.length) nodes.value.push(createEmptyNode());
}

async function save() {
  // 画布模式下先回写拖拽后的节点坐标，再走统一校验与载荷装配
  canvasRef.value?.syncLayout();
  const errorKey = validateFlowConfig(basic, nodes.value);
  if (errorKey) {
    ElMessage.error(t(errorKey));
    return;
  }
  const payload = buildFlowPayload(basic, fields.value, nodes.value);
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
    <FlowFieldsEditor :fields="fields" />

    <el-divider content-position="left">
      {{ t("systemApprovalFlow.nodesTitle") }}
    </el-divider>
    <div class="mb-2 flex-bc">
      <el-alert
        :closable="false"
        type="info"
        :title="t('systemApprovalFlow.nodesTip')"
        class="flex-1"
      />
      <el-radio-group v-model="editMode" size="small" class="ml-3">
        <el-radio-button value="list">{{
          t("systemApprovalFlow.modeList")
        }}</el-radio-button>
        <el-radio-button value="canvas">{{
          t("systemApprovalFlow.modeCanvas")
        }}</el-radio-button>
      </el-radio-group>
    </div>
    <FlowCanvas v-show="editMode === 'canvas'" ref="canvasRef" :nodes="nodes" />
    <FlowNodesEditor v-show="editMode === 'list'" :nodes="nodes" />

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
