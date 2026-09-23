<script lang="ts" setup>
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { listRows } from "@/api/base";
import { searchUserApi } from "@/api/system/search";
import { roleApi } from "@/api/system/role";
import {
  ASSIGNEE_TYPES,
  CONDITION_OPS,
  createEmptyNode,
  type FieldRow,
  type NodeRow
} from "./flowConfig";
import RouteEditorForm from "./RouteEditorForm.vue";

/** 审批节点编辑表格（顺序 + 策略 OR/AND/RATIO + 审批人解析 + 节点条件 + 出口路由 + 超时）；就地编辑父组件传入的行数组 */
const props = defineProps<{ nodes: NodeRow[]; fields?: FieldRow[] }>();

const { t } = useI18n();

/* ---------------- 审批人选择器（避免裸文本输错用户名/角色码） ---------------- */

/** 始终提供可查询下拉（用户远程搜索 / 角色下拉），搜索无结果时允许直接输入兜底 */

const userOptions = ref<Array<{ username: string; label: string }>>([]);
const userLoading = ref(false);
const roleOptions = ref<Array<{ name: string; code: string }>>([]);

/** 逗号分隔串 ↔ 多选数组（服务端契约：assignee_value 为逗号分隔串） */
function splitValues(value: string): string[] {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function joinValues(values: unknown): string {
  return (Array.isArray(values) ? values : [values]).map(String).join(",");
}

/** el-select 多选回写：事件载荷是宽联合、el-table 的 row 是 DefaultRow，统一按行号写回 */
function updateMultiValue(index: number, value: unknown) {
  const node = props.nodes[index];
  if (node) node.assignee_value = joinValues(value);
}

/** 已选用户并入选项：未搜索时也能看到已选人员（后端只存用户名，无法反查昵称） */
function ensureUserOption(username: string) {
  if (!username) return;
  if (!userOptions.value.some(item => item.username === username)) {
    userOptions.value.push({ username, label: username });
  }
}

async function searchUsers(query: string) {
  if (!query) return;
  userLoading.value = true;
  try {
    const res = await searchUserApi.list({
      page: 1,
      size: 20,
      username: query
    });
    if (res.code === SUCCESS_CODE && res.data) {
      const rows = listRows<{ username: string; nickname?: string }>(
        res as never
      );
      const fetched = rows.map(user => ({
        username: user.username,
        label: user.nickname
          ? `${user.nickname}(${user.username})`
          : user.username
      }));
      const fetchedNames = new Set(fetched.map(item => item.username));
      userOptions.value = [
        ...fetched,
        ...userOptions.value.filter(item => !fetchedNames.has(item.username))
      ];
    }
  } catch {
    // 搜索失败保持已选选项，不打断编辑
  } finally {
    userLoading.value = false;
  }
}

onMounted(async () => {
  const res = await fetchAllRows(roleApi.list).catch(() => null);
  if (res && res.code === SUCCESS_CODE && res.data) {
    roleOptions.value = listRows<{ name: string; code: string }>(res as never);
  }
});

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
        <template #default="{ row, $index }">
          <!-- leader：由申请人部门负责人解析，无需填写 -->
          <el-input
            v-if="row.assignee_type === 'leader'"
            v-model="row.assignee_value"
            size="small"
            disabled
            :placeholder="t('systemApprovalFlow.assigneeHint_leader')"
          />
          <!-- 指定用户：按用户名远程搜索多选（值=用户名，逗号分隔）；搜索无结果可直接输入用户名兜底 -->
          <el-select
            v-else-if="row.assignee_type === 'user'"
            :model-value="splitValues(row.assignee_value)"
            multiple
            filterable
            remote
            allow-create
            default-first-option
            reserve-keyword
            size="small"
            :remote-method="searchUsers"
            :loading="userLoading"
            :placeholder="t('systemApprovalFlow.assigneeHint_user')"
            @focus="splitValues(row.assignee_value).forEach(ensureUserOption)"
            @update:model-value="value => updateMultiValue($index, value)"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.username"
              :label="user.label"
              :value="user.username"
            />
          </el-select>
          <!-- 角色：按角色名多选（值=角色编码）；可直接输入角色 code 兜底 -->
          <el-select
            v-else-if="row.assignee_type === 'role'"
            :model-value="splitValues(row.assignee_value)"
            multiple
            filterable
            allow-create
            default-first-option
            size="small"
            :placeholder="t('systemApprovalFlow.assigneeHint_role')"
            @update:model-value="value => updateMultiValue($index, value)"
          >
            <el-option
              v-for="role in roleOptions"
              :key="role.code"
              :label="role.name"
              :value="role.code"
            />
          </el-select>
          <!-- 表单字段：单选（值=字段 key，来自本流程已配置的表单字段） -->
          <el-select
            v-else-if="row.assignee_type === 'field' && (fields ?? []).length"
            v-model="row.assignee_value"
            size="small"
            clearable
            :placeholder="t('systemApprovalFlow.assigneeHint_field')"
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
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('systemApprovalFlow.ccUsers')" min-width="150">
        <template #default="{ row }">
          <!-- 抄送人（节点级默认）：与审批人同口径的多选（用户名数组，可直接输入兜底） -->
          <el-select
            :model-value="row.cc_users || []"
            multiple
            filterable
            remote
            allow-create
            default-first-option
            reserve-keyword
            size="small"
            :remote-method="searchUsers"
            :loading="userLoading"
            :placeholder="t('systemApprovalFlow.ccUsersHint')"
            @focus="(row.cc_users || []).forEach(ensureUserOption)"
            @update:model-value="value => (row.cc_users = value)"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.username"
              :label="user.label"
              :value="user.username"
            />
          </el-select>
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
