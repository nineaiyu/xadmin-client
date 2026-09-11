<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { ASSIGNEE_TYPES, CONDITION_OPS, type NodeRow } from "./flowConfig";

/** 审批节点编辑表格（顺序 + 或签会签 + 审批人解析 + 节点条件 + 超时小时）；就地编辑父组件传入的行数组 */
defineProps<{ nodes: NodeRow[] }>();

const { t } = useI18n();

function addNode(nodes: NodeRow[]) {
  nodes.push({
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

function removeNode(nodes: NodeRow[], index: number) {
  nodes.splice(index, 1);
}

function moveNode(nodes: NodeRow[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= nodes.length) return;
  [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
}
</script>
<template>
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
    <el-table-column :label="t('systemApprovalFlow.assigneeType')" width="130">
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
    <el-table-column :label="t('systemApprovalFlow.timeoutHours')" width="110">
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
        <el-button link type="primary" size="small" @click="addNode(nodes)">
          {{ t("systemApprovalFlow.addNode") }}
        </el-button>
      </template>
      <template #default="{ $index }">
        <el-button
          link
          size="small"
          :disabled="$index === 0"
          @click="moveNode(nodes, $index, -1)"
        >
          ↑
        </el-button>
        <el-button
          link
          size="small"
          :disabled="$index === nodes.length - 1"
          @click="moveNode(nodes, $index, 1)"
        >
          ↓
        </el-button>
        <el-button
          link
          type="danger"
          size="small"
          @click="removeNode(nodes, $index)"
        >
          {{ t("buttons.delete") }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style lang="scss" scoped>
.nodes-table {
  :deep(.el-input-number) {
    width: 100%;
  }
}
</style>
