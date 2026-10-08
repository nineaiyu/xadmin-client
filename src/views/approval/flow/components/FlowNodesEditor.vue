<script lang="ts" setup>
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { listRows } from "@/api/base";
import { approvalRuleApi } from "@/api/approval/approvalRule";
import { roleApi } from "@/api/system/role";
import { postApi } from "@/api/system/post";
import {
  ASSIGNEE_TYPES,
  CONDITION_OPS,
  TIMEOUT_ACTIONS,
  createEmptyNode,
  type FieldRow,
  type NodeRow
} from "./flowConfig";
import RouteEditorForm from "./RouteEditorForm.vue";
import { joinValues, splitValues } from "@/views/approval/utils/assigneeValues";

/** 审批节点编辑表格（顺序 + 策略 OR/AND/RATIO + 审批人解析 + 节点条件 + 出口路由 + 超时）；就地编辑父组件传入的行数组 */
const props = defineProps<{ nodes: NodeRow[]; fields?: FieldRow[] }>();

const { t } = useI18n();

/* ---------------- 审批人选择器（避免裸文本输错用户名/角色码） ---------------- */

/** 始终提供可查询下拉（用户候选目录本地过滤 / 角色下拉），搜索无结果时允许直接输入兜底 */

const userOptions = ref<Array<{ username: string; label: string }>>([]);
const userLoading = ref(false);
/** 审批模块自给候选目录：单次拉取 + 本地过滤，不依赖可独立裁剪的全局搜索模块 */
const allUserCandidates = ref<Array<{ username: string; label: string }>>([]);
/** 候选目录被服务端截断（用户数超上限）：本地过滤结果可能不全，需提示细化搜索 */
const candidateTruncated = ref(false);
const roleOptions = ref<Array<{ name: string; code: string }>>([]);
/** 岗位下拉（值=岗位 code）：仅启用岗位可选，停用岗位后端不参与解析 */
const postOptions = ref<Array<{ name: string; code: string }>>([]);

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

function searchUsers(query: string) {
  userLoading.value = true;
  try {
    const keyword = query.trim().toLowerCase();
    const matched = keyword
      ? allUserCandidates.value.filter(
          item =>
            item.username.toLowerCase().includes(keyword) ||
            item.label.toLowerCase().includes(keyword)
        )
      : allUserCandidates.value;
    const matchedNames = new Set(matched.map(item => item.username));
    userOptions.value = [
      ...matched,
      ...userOptions.value.filter(item => !matchedNames.has(item.username))
    ];
  } finally {
    userLoading.value = false;
  }
}

onMounted(async () => {
  const res = await fetchAllRows(roleApi.list).catch(() => null);
  if (res && res.code === SUCCESS_CODE && res.data) {
    roleOptions.value = listRows<{ name: string; code: string }>(res as never);
  }
  const postRes = await fetchAllRows(postApi.list).catch(() => null);
  if (postRes && postRes.code === SUCCESS_CODE && postRes.data) {
    postOptions.value = listRows<{
      name: string;
      code: string;
      is_active?: boolean;
    }>(postRes as never).filter(post => post.is_active !== false);
  }
  const candidateRes = await approvalRuleApi
    .candidateOptions()
    .catch(() => null);
  if (candidateRes && candidateRes.code === SUCCESS_CODE && candidateRes.data) {
    candidateTruncated.value = Boolean(
      (candidateRes.data as { truncated?: boolean }).truncated
    );
    allUserCandidates.value = (
      (candidateRes.data.users ?? []) as Array<{
        username: string;
        nickname?: string;
      }>
    ).map(user => ({
      username: user.username,
      label: user.nickname
        ? `${user.nickname}(${user.username})`
        : user.username
    }));
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
    <el-alert
      v-if="candidateTruncated"
      type="warning"
      :closable="false"
      class="mb-2"
      :title="t('approval.candidateTruncated')"
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
          <!-- 岗位：按岗位名多选（值=岗位 code，逗号分隔）；后端仅启用岗位的在岗用户参与解析 -->
          <el-select
            v-else-if="row.assignee_type === 'post'"
            :model-value="splitValues(row.assignee_value)"
            multiple
            filterable
            allow-create
            default-first-option
            size="small"
            :placeholder="t('systemApprovalFlow.assigneeHint_post')"
            @update:model-value="value => updateMultiValue($index, value)"
          >
            <el-option
              v-for="post in postOptions"
              :key="post.code"
              :label="post.name"
              :value="post.code"
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
      <el-table-column
        :label="t('systemApprovalFlow.timeoutAction')"
        width="130"
      >
        <template #default="{ row }">
          <!-- 超时自动动作：仅在配置了超时小时数时生效（否则仅提醒） -->
          <el-select
            v-if="Number(row.timeout_hours) > 0"
            v-model="row.timeout_action"
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
