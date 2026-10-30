<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import DataTable from "@/components/DataTable";
import { joinValues, splitValues } from "@/views/approval/utils/assigneeValues";
import ApproverPicker from "@/views/approval/components/ApproverPicker.vue";
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

type ApproverType = "user" | "role" | "post";

function isApproverType(type: string): type is ApproverType {
  return type === "user" || type === "role" || type === "post";
}

/** 兜底分支不会走到，仅用于模板取到收窄后的 type */
function approverTypeOf(type: string): ApproverType {
  return isApproverType(type) ? type : "user";
}

const LEVEL_HINT_KEYS: Record<ApproverType, string> = {
  user: "approvalRule.levelUserTip",
  role: "approvalRule.levelRoleTip",
  post: "approvalRule.levelPostTip"
};

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
    <p class="mb-2 text-xs text-(--el-text-color-regular)">
      {{ t("approvalRule.levelsTip") }}
    </p>
    <DataTable
      :data="levels"
      size="small"
      border
      :label="t('approvalRule.levels')"
    >
      <el-table-column
        type="index"
        width="50"
        :label="t('approvalRule.levelOrder')"
      />
      <el-table-column :label="t('approvalRule.levelName')" width="120">
        <template #default="{ row }">
          <el-input
            v-model="row.name"
            size="small"
            :placeholder="t('approvalRule.levelNamePlaceholder')"
          />
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
          <!-- 指定用户 / 角色 / 岗位：候选目录多选（用户远程搜索；均可直输 code 兜底） -->
          <ApproverPicker
            v-if="isApproverType(row.assignee_type)"
            :model-value="row.assignee_list"
            :type="approverTypeOf(row.assignee_type)"
            show-code
            truncated-hint
            :placeholder="t(LEVEL_HINT_KEYS[approverTypeOf(row.assignee_type)])"
            @update:model-value="value => updateLevelValue($index, value)"
          />
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
    </DataTable>
    <el-button class="mt-2" size="small" @click="addLevel">
      {{ t("approvalRule.addLevel") }}
    </el-button>
  </div>
</template>
