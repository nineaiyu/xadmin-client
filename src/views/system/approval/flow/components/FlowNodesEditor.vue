<script lang="ts" setup>
import { h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import {
  ASSIGNEE_TYPES,
  CONDITION_OPS,
  createEmptyNode,
  type NodeRow
} from "./flowConfig";
import RouteEditorForm from "./RouteEditorForm.vue";

/** 审批节点编辑表格（顺序 + 策略 OR/AND/RATIO + 审批人解析 + 节点条件 + 出口路由 + 超时）；就地编辑父组件传入的行数组 */
defineProps<{ nodes: NodeRow[] }>();

const { t } = useI18n();

/** 分支路由编辑（C5：统一走 ReDialog，路由表格在 RouteEditorForm 中） */
const routeFormRef = ref<InstanceType<typeof RouteEditorForm>>();

function openRouteEditor(nodes: NodeRow[], index: number) {
  const order = index + 1;
  const count = nodes.length;
  const routes = (nodes[index].routes || []).map(route => ({
    condition: { ...(route.condition || {}) },
    target: Number(route.target)
  }));
  routeFormRef.value = undefined;
  addDialog({
    title: t("systemApprovalFlow.routesTitle"),
    width: dialogSize("lg"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(RouteEditorForm, { ref: routeFormRef, order, count, routes }),
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

function removeNode(nodes: NodeRow[], index: number) {
  nodes.splice(index, 1);
}

function moveNode(nodes: NodeRow[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= nodes.length) return;
  [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
}

/** 审批人值占位符 i18n key：类型缺失/非法时回退 role，避免拼出 assigneeHint_undefined */
function assigneeHint(type: string): string {
  const fallback = ASSIGNEE_TYPES.includes(type) ? type : "role";
  return `systemApprovalFlow.assigneeHint_${fallback}`;
}
</script>
<template>
  <!-- 单根包裹：父组件用 v-show 切换列表/画布，多根组件上运行时指令（v-show）不生效并告警 -->
  <div>
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
            :placeholder="t(assigneeHint(row.assignee_type))"
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
