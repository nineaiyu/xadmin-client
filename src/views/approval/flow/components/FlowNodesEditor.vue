<script lang="ts" setup>
import { h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { approvalFlowApi } from "@/api/approval/approvalFlow";
import { useConfirm } from "@/hooks/useConfirm";
import ApproverPicker from "@/views/approval/components/ApproverPicker.vue";
import {
  ASSIGNEE_TYPES,
  CONDITION_OPS,
  TIMEOUT_ACTIONS,
  createEmptyNode,
  remapRouteTargets,
  conditionOpLabel,
  type FieldRow,
  type NodeRow
} from "./flowConfig";
import RouteEditorForm from "./RouteEditorForm.vue";
import { joinValues, splitValues } from "@/views/approval/utils/assigneeValues";

/** 审批节点编辑表格（顺序 + 策略 OR/AND/RATIO + 审批人解析 + 节点条件 + 出口路由 + 超时）；就地编辑父组件传入的行数组 */
const props = defineProps<{ nodes: NodeRow[]; fields?: FieldRow[] }>();

const { t } = useI18n();
const confirm = useConfirm();

/* ---------------- 审批人选择器（避免裸文本输错用户名/角色码） ---------------- */

type ApproverType = "user" | "role" | "post";

function isApproverType(type: string): type is ApproverType {
  return type === "user" || type === "role" || type === "post";
}

/** 兜底分支不会走到，仅用于模板取到收窄后的 type */
function approverTypeOf(type: string): ApproverType {
  return isApproverType(type) ? type : "role";
}

/** el-select 多选回写：事件载荷是宽联合、el-table 的 row 是 DefaultRow，统一按行号写回 */
function updateMultiValue(index: number, value: unknown) {
  const node = props.nodes[index];
  if (node) node.assignee_value = joinValues(value);
}

/** 节点级抄送人：用户名数组，保持原数组载荷 */
function updateCcUsers(row: { cc_users?: string[] }, value: unknown) {
  row.cc_users = (Array.isArray(value) ? value : []).map(String);
}

/** 分支路由编辑（统一走 ReDialog，路由表格在 RouteEditorForm 中） */
const routeFormRef = ref<InstanceType<typeof RouteEditorForm>>();

function openRouteEditor(nodes: NodeRow[], index: number) {
  const order = index + 1;
  const count = nodes.length;
  const routes = (nodes[index].routes || []).map(route => ({
    condition: { ...(route.condition || {}) },
    target: Number(route.target)
  }));
  const nodeOptions = nodes.map((node, position) => ({
    order: position + 1,
    name: node.name
  }));
  routeFormRef.value = undefined;
  addDialog({
    title: t("systemApprovalFlow.routesTitle"),
    width: dialogSize("lg"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(RouteEditorForm, {
        ref: routeFormRef,
        order,
        count,
        nodeOptions,
        routes
      }),
    beforeSure: (done, { closeLoading }) => {
      const updated = routeFormRef.value?.getRoutes();
      if (!updated) {
        closeLoading();
        return;
      }
      // 回写：过滤自环与越界 target（同原实现口径）
      nodes[index].routes = updated;
      done();
    }
  });
}

function addNode(nodes: NodeRow[]) {
  nodes.push(createEmptyNode());
}

async function removeNode(nodes: NodeRow[], index: number) {
  if (!(await confirm(t("systemApprovalFlow.removeNodeConfirm")))) return;
  const snapshot = nodes.slice();
  nodes.splice(index, 1);
  // 出口路由 target 是节点 order：删节点后必须重映射/丢弃，否则跳到错误节点
  remapRouteTargets(nodes, snapshot);
}

function moveNode(nodes: NodeRow[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= nodes.length) return;
  const snapshot = nodes.slice();
  [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
  remapRouteTargets(nodes, snapshot);
}

/** 审批人值占位符 i18n key：类型缺失/非法时回退 role，避免拼出 assigneeHint_undefined */
function assigneeHint(type: string): string {
  const fallback = ASSIGNEE_TYPES.includes(type) ? type : "role";
  return `systemApprovalFlow.assigneeHint_${fallback}`;
}
</script>
<template>
  <div>
    <!-- 单根包裹：父组件用 v-show 切换列表/画布，多根组件上运行时指令（v-show）不生效并告警 -->
    <el-table :data="nodes" size="small" border class="nodes-table">
      <el-table-column
        type="index"
        width="50"
        :label="t('systemApprovalFlow.nodeOrder')"
      />
      <el-table-column :label="t('systemApprovalFlow.nodeName')" width="140">
        <template #default="{ row }">
          <el-input
            v-model="row.name"
            size="small"
            :aria-label="t('systemApprovalFlow.nodeName')"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.approveType')" width="110">
        <template #default="{ row }">
          <el-select
            v-model="row.approve_type"
            size="small"
            :aria-label="t('systemApprovalFlow.approveType')"
          >
            <el-option
              :label="t('systemApprovalFlow.approveTypeOR')"
              value="OR"
            />
            <el-option
              :label="t('systemApprovalFlow.approveTypeAND')"
              value="AND"
            />
            <el-option
              :label="t('systemApprovalFlow.approveTypeRATIO')"
              value="RATIO"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        v-if="nodes.some(node => node.approve_type === 'RATIO')"
        :label="t('systemApprovalFlow.approveRatio')"
        width="110"
      >
        <template #default="{ row }">
          <el-input-number
            v-if="row.approve_type === 'RATIO'"
            v-model="row.approve_ratio"
            size="small"
            :min="1"
            :max="100"
            :aria-label="t('systemApprovalFlow.approveRatio')"
            controls-position="right"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.assigneeType')"
        width="130"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.assignee_type"
            size="small"
            :aria-label="t('systemApprovalFlow.assigneeType')"
          >
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
        <template #default="{ row, $index }">
          <!-- leader：由申请人部门负责人解析，无需填写 -->
          <el-input
            v-if="row.assignee_type === 'leader'"
            v-model="row.assignee_value"
            size="small"
            disabled
            :placeholder="t('systemApprovalFlow.assigneeHint_leader')"
            :aria-label="t('systemApprovalFlow.assigneeValue')"
          />
          <!-- 指定用户 / 角色 / 岗位：候选目录多选（用户远程搜索；均可直输 code 兜底） -->
          <ApproverPicker
            v-else-if="isApproverType(row.assignee_type)"
            :model-value="splitValues(row.assignee_value)"
            :type="approverTypeOf(row.assignee_type)"
            :size="'small'"
            :fetcher="approvalFlowApi.candidateOptions"
            truncated-hint
            :placeholder="
              t(`systemApprovalFlow.assigneeHint_${row.assignee_type}`)
            "
            :aria-label="t('systemApprovalFlow.assigneeValue')"
            @update:model-value="value => updateMultiValue($index, value)"
          />
          <!-- 表单字段：单选（值=字段 key，来自本流程已配置的表单字段） -->
          <el-select
            v-else-if="row.assignee_type === 'field' && (fields ?? []).length"
            v-model="row.assignee_value"
            size="small"
            clearable
            :placeholder="t('systemApprovalFlow.assigneeHint_field')"
            :aria-label="t('systemApprovalFlow.assigneeValue')"
          >
            <el-option
              v-for="field in fields"
              :key="field.key"
              :label="field.label || field.key"
              :value="field.key"
            />
          </el-select>
          <!-- 兜底：未知类型 / 字段未配置 → 纯文本输入 -->
          <el-input
            v-else
            v-model="row.assignee_value"
            size="small"
            :placeholder="t(assigneeHint(row.assignee_type))"
            :aria-label="t('systemApprovalFlow.assigneeValue')"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.ccUsers')" min-width="150">
        <template #default="{ row }">
          <!-- 抄送人（节点级默认）：与审批人同口径的多选（用户名数组，可直接输入兜底） -->
          <ApproverPicker
            :model-value="row.cc_users || []"
            type="user"
            :fetcher="approvalFlowApi.candidateOptions"
            :placeholder="t('systemApprovalFlow.ccUsersHint')"
            :aria-label="t('systemApprovalFlow.ccUsers')"
            @update:model-value="value => updateCcUsers(row, value)"
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
            :aria-label="t('systemApprovalFlow.conditionField')"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.conditionOp')" width="120">
        <template #default="{ row }">
          <el-select
            v-model="row.condition_op"
            size="small"
            :disabled="!row.condition_field"
            :aria-label="t('systemApprovalFlow.conditionOp')"
          >
            <el-option
              v-for="op in CONDITION_OPS"
              :key="op"
              :label="conditionOpLabel(op, t)"
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
            :aria-label="t('systemApprovalFlow.conditionValue')"
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
            :aria-label="t('systemApprovalFlow.timeoutHours')"
            controls-position="right"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemApprovalFlow.timeoutAction')"
        width="130"
      >
        <template #default="{ row }">
          <!-- 超时自动动作：仅在配置了超时小时数时生效（否则仅提醒） -->
          <el-select
            v-if="Number(row.timeout_hours) > 0"
            v-model="row.timeout_action"
            :aria-label="t('systemApprovalFlow.timeoutAction')"
            size="small"
          >
            <el-option
              v-for="action in TIMEOUT_ACTIONS"
              :key="action"
              :label="
                t(`systemApprovalFlow.timeoutAction_${action}`, {
                  defaultValue: action
                })
              "
              :value="action"
            />
          </el-select>
          <span v-else class="text-xs text-(--el-text-color-secondary)">
            {{ t("systemApprovalFlow.timeoutActionHint") }}
          </span>
        </template>
      </el-table-column>
      <el-table-column width="210" align="center">
        <template #header>
          <el-button link type="primary" size="small" @click="addNode(nodes)">
            {{ t("systemApprovalFlow.addNode") }}
          </el-button>
        </template>
        <template #default="{ $index }">
          <el-button
            link
            type="primary"
            size="small"
            :aria-label="t('systemApprovalFlow.routes')"
            @click="openRouteEditor(nodes, $index)"
          >
            {{ t("systemApprovalFlow.routes") }}
          </el-button>
          <el-button
            link
            size="small"
            :disabled="$index === 0"
            :aria-label="t('systemApprovalFlow.moveUp')"
            @click="moveNode(nodes, $index, -1)"
          >
            ↑
          </el-button>
          <el-button
            link
            size="small"
            :disabled="$index === nodes.length - 1"
            :aria-label="t('systemApprovalFlow.moveDown')"
            @click="moveNode(nodes, $index, 1)"
          >
            ↓
          </el-button>
          <el-button
            link
            type="danger"
            size="small"
            :aria-label="t('buttons.delete')"
            @click="removeNode(nodes, $index)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.nodes-table {
  :deep(.el-input-number) {
    width: 100%;
  }
}
</style>
