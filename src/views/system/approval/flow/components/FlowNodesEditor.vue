<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ASSIGNEE_TYPES,
  CONDITION_OPS,
  createEmptyNode,
  type NodeRow,
  type RouteItem
} from "./flowConfig";

/** 审批节点编辑表格（顺序 + 策略 OR/AND/RATIO + 审批人解析 + 节点条件 + 出口路由 + 超时）；就地编辑父组件传入的行数组 */
defineProps<{ nodes: NodeRow[] }>();

const { t } = useI18n();

/** 分支路由编辑：节点序号（1-based）+ 全部节点数 + routes 副本（保存时回写） */
const routeEditor = ref<{
  order: number;
  count: number;
  routes: RouteItem[];
} | null>(null);
const routeEditorVisible = ref(false);

function openRouteEditor(nodes: NodeRow[], index: number) {
  routeEditor.value = {
    order: index + 1,
    count: nodes.length,
    routes: (nodes[index].routes || []).map(route => ({
      condition: { ...(route.condition || {}) },
      target: Number(route.target)
    }))
  };
  routeEditorVisible.value = true;
}

function addRoute(routes: RouteItem[]) {
  routes.push({ condition: { field: "", op: "eq", value: "" }, target: 1 });
}

function saveRouteEditor(nodes: NodeRow[], index: number) {
  const editor = routeEditor.value;
  if (!editor) return;
  // 回写：过滤自环与越界 target
  nodes[index].routes = editor.routes.filter(
    route =>
      route.target >= 1 &&
      route.target <= editor.count &&
      route.target !== editor.order
  );
  routeEditor.value = null;
  routeEditorVisible.value = false;
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

  <el-dialog
    v-model="routeEditorVisible"
    :title="t('systemApprovalFlow.routesTitle')"
    width="720px"
    destroy-on-close
  >
    <el-alert
      :closable="false"
      type="info"
      :title="t('systemApprovalFlow.routesTip')"
      class="mb-3"
    />
    <el-table v-if="routeEditor" :data="routeEditor.routes" size="small" border>
      <el-table-column
        :label="t('systemApprovalFlow.conditionField')"
        width="150"
      >
        <template #default="{ row }">
          <el-input v-model="row.condition.field" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.conditionOp')" width="120">
        <template #default="{ row }">
          <el-select v-model="row.condition.op" size="small">
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
        width="150"
      >
        <template #default="{ row }">
          <el-input v-model="row.condition.value" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.routeTarget')">
        <template #default="{ row, $index }">
          <el-select v-model="row.target" size="small" class="w-45!">
            <el-option
              v-for="order in routeEditor.count"
              :key="order"
              :label="`${t('systemApprovalFlow.nodeOrder')} ${order}`"
              :value="order"
              :disabled="order === routeEditor.order"
            />
          </el-select>
          <el-button
            link
            type="danger"
            size="small"
            class="ml-1"
            @click="routeEditor.routes.splice($index, 1)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button
      link
      type="primary"
      size="small"
      class="mt-2"
      @click="routeEditor && addRoute(routeEditor.routes)"
    >
      {{ t("systemApprovalFlow.addRoute") }}
    </el-button>
    <template #footer>
      <el-button @click="routeEditorVisible = false">
        {{ t("buttons.cancel") }}
      </el-button>
      <el-button
        type="primary"
        @click="nodes && saveRouteEditor(nodes, routeEditor.order - 1)"
      >
        {{ t("buttons.save") }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.nodes-table {
  :deep(.el-input-number) {
    width: 100%;
  }
}
</style>
