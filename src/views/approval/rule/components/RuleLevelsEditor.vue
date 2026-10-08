<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { joinValues, splitValues } from "@/views/approval/utils/assigneeValues";
import { useAssigneeCandidates } from "@/views/approval/utils/useAssigneeCandidates";
import { createLevelRow, type LevelRow } from "../utils/types";

/**
 * 审批规则「审批级次」编辑器（自 RuleForm 拆出，行为不变）：
 * 级次顺序即审批顺序（服务端按数组下标重排 order），支持上移/下移与增删；
 * 级内支持或签/会签，审批人支持用户（远程搜索 + 直输兜底）/ 角色 / 岗位。
 *
 * 数据流：levels 为父表单的 reactive 数组引用，子组件就地增删改。
 */
defineOptions({ name: "ApprovalRuleLevelsEditor" });

const levels = defineModel<LevelRow[]>("levels", { required: true });

const { t } = useI18n();

const { userOptions, candidateTruncated, roleOptions, postOptions } =
  useAssigneeCandidates();

/** 级次行内下拉回写：多选数组 → 逗号串（服务端契约） */
function updateLevelValue(index: number, value: unknown) {
  const level = levels.value[index];
  if (!level) return;
  level.assignee_list = (Array.isArray(value) ? value : [value]).map(String);
  level.assignee_value = joinValues(value);
}

/** 切换审批人类型：清空已选（用户名与角色 code 不通用） */
function onAssigneeTypeChange(index: number) {
  const level = levels.value[index];
  if (!level) return;
  level.assignee_list = [];
  level.assignee_value = "";
}

function addLevel() {
  levels.value = [...levels.value, createLevelRow()];
}

function removeLevel(index: number) {
  levels.value = levels.value.filter((_, position) => position !== index);
}

/** 上移/下移：级次顺序即审批顺序（服务端按数组下标重排 order） */
function moveLevel(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= levels.value.length) return;
  const next = [...levels.value];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  levels.value = next;
}
</script>

<template>
  <div class="w-full">
    <el-alert
      v-if="candidateTruncated"
      type="warning"
      :closable="false"
      class="mb-2"
      :title="t('approval.candidateTruncated')"
    />
    <p class="mb-2 text-xs text-(--el-text-color-regular)">
      {{ t("approvalRule.levelsTip") }}
    </p>
    <el-table :data="levels" size="small" border>
      <el-table-column
        type="index"
        width="50"
        :label="t('approvalRule.levelOrder')"
      />
      <el-table-column :label="t('approvalRule.levelName')" width="120">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" />
        </template>
      </el-table-column>
      <el-table-column :label="t('approvalRule.approveType')" width="120">
        <template #default="{ row }">
          <el-select v-model="row.approve_type" size="small">
            <el-option :label="t('approvalRule.approveTypeOR')" value="OR" />
            <el-option :label="t('approvalRule.approveTypeAND')" value="AND" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column :label="t('approvalRule.levelType')" width="110">
        <template #default="{ row, $index }">
          <el-select
            v-model="row.assignee_type"
            size="small"
            @change="onAssigneeTypeChange($index)"
          >
            <el-option :label="t('approvalRule.levelTypeUser')" value="user" />
            <el-option :label="t('approvalRule.levelTypeRole')" value="role" />
            <el-option :label="t('approvalRule.levelTypePost')" value="post" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column :label="t('approvalRule.levelAssignee')" min-width="210">
        <template #default="{ row, $index }">
          <!-- 指定用户：远程搜索 + 允许直接输入用户名兜底（无搜索结果时回车即录入） -->
          <el-select
            v-if="row.assignee_type === 'user'"
            :model-value="row.assignee_list"
            multiple
            filterable
            allow-create
            default-first-option
            size="small"
            :placeholder="t('approvalRule.levelUserTip')"
            @update:model-value="value => updateLevelValue($index, value)"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.username"
              :label="user.label"
              :value="user.username"
            />
          </el-select>
          <!-- 角色：下拉选择（值=角色 code，可直接输入 code 兜底） -->
          <el-select
            v-else-if="row.assignee_type === 'role'"
            :model-value="row.assignee_list"
            multiple
            filterable
            allow-create
            default-first-option
            size="small"
            :placeholder="t('approvalRule.levelRoleTip')"
            @update:model-value="value => updateLevelValue($index, value)"
          >
            <el-option
              v-for="role in roleOptions"
              :key="role.code"
              :label="`${role.name}(${role.code})`"
              :value="role.code"
            />
          </el-select>
          <!-- 岗位：下拉选择（值=岗位 code，仅启用岗位的在岗用户参与解析） -->
          <el-select
            v-else-if="row.assignee_type === 'post'"
            :model-value="row.assignee_list"
            multiple
            filterable
            allow-create
            default-first-option
            size="small"
            :placeholder="t('approvalRule.levelPostTip')"
            @update:model-value="value => updateLevelValue($index, value)"
          >
            <el-option
              v-for="post in postOptions"
              :key="post.code"
              :label="`${post.name}(${post.code})`"
              :value="post.code"
            />
          </el-select>
          <!-- 未知/历史类型兜底：纯文本输入 -->
          <el-input
            v-else
            :model-value="row.assignee_value"
            size="small"
            :placeholder="t('approvalRule.levelAssigneeFallback')"
            @update:model-value="
              value => updateLevelValue($index, splitValues(String(value)))
            "
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('approvalRule.levelActions')" width="190">
        <template #default="{ $index }">
          <el-button
            link
            type="primary"
            size="small"
            :disabled="$index === 0"
            @click="moveLevel($index, -1)"
          >
            {{ t("approvalRule.moveUp") }}
          </el-button>
          <el-button
            link
            type="primary"
            size="small"
            :disabled="$index === levels.length - 1"
            @click="moveLevel($index, 1)"
          >
            {{ t("approvalRule.moveDown") }}
          </el-button>
          <el-button
            link
            type="danger"
            size="small"
            :disabled="levels.length <= 1"
            @click="removeLevel($index)"
          >
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-button class="mt-2" size="small" @click="addLevel">
      {{ t("approvalRule.addLevel") }}
    </el-button>
  </div>
</template>
