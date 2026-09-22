<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { FormInstance, FormRules } from "element-plus";
import type { RecordType } from "plus-pro-components";
import { SUCCESS_CODE } from "@/api/types";
import { loadPatScopeCatalog } from "@/api/user/token";
import { approvalRuleApi } from "@/api/system/approvalRule";
import type { ScopeGroup } from "@/utils/scopeDisplay";

defineOptions({ name: "ApprovalRuleForm" });

/**
 * 审批规则表单（多级审批链）：
 *
 * - **匹配路径**：从「接口清单」（与访问令牌同一份目录，按本人权限收口）勾选，
 *   或在下方的自定义区写路径正则（高级用法，含历史数据回显）；
 * - **审批级次**：按顺序逐级审批，支持上移/下移排序；
 * - **级内多人**：或签（任一通过即进入下一级）/ 会签（全部通过才进入下一级）；
 * - **审批人**：指定用户走远程搜索（可多选，允许直接输入用户名兜底）/ 角色下拉；
 *   保存时服务端校验用户名/角色 code 存在性。
 */
const props = defineProps<{ row?: RecordType | null }>();

const { t, te } = useI18n();
const formRef = ref<FormInstance>();

type LevelRow = {
  name: string;
  approve_type: string;
  assignee_type: string;
  assignee_value: string;
  /** 级次行内 el-select 的展示值（多选数组），提交时 join 成逗号串 */
  assignee_list: string[];
};

const form = reactive({
  name: "",
  /** 勾选自接口清单的路径（锚定路径正则） */
  pathSelected: [] as Array<string>,
  /** 自定义路径正则（一行一条） */
  customPaths: "",
  priority: 0,
  is_active: true,
  remark: "",
  levels: [] as Array<LevelRow>
});

const rules: FormRules = {
  name: [
    {
      required: true,
      message: t("approvalRule.nameRequired"),
      trigger: "blur"
    }
  ]
};

/* ---------------- 接口清单（与访问令牌同源目录） ---------------- */

const scopeGroups = ref<ScopeGroup[]>([]);
const scopeLoading = ref(false);

/** scope 条目（`GET ^/api/...$`）→ 路径正则（`^/api/...$`）：审批拦截按路径匹配 */
const toPathPattern = (value: string) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/);
  return parts.slice(1).join(" ").trim() || value;
};

/** 分组标题翻译：菜单标题可能是 i18n key（与接口范围编辑器同口径） */
const labelOf = (title: string) =>
  title ? (te(title) ? t(title) : title) : t("apiScope.other");

const loadScopeGroups = async () => {
  scopeLoading.value = true;
  try {
    const res = await loadPatScopeCatalog();
    if (res.code !== SUCCESS_CODE || !res.data?.groups) return;
    scopeGroups.value = res.data.groups.map(group => {
      const seen = new Set<string>();
      const options = (group.options ?? [])
        .map(option => ({ ...option, value: toPathPattern(option.value) }))
        .filter(option => {
          if (!option.value || seen.has(option.value)) return false;
          seen.add(option.value);
          return true;
        });
      return { ...group, options };
    });
  } catch {
    // 目录拉取失败不阻塞：自定义区仍可写路径正则
  } finally {
    scopeLoading.value = false;
  }
};

const knownPaths = computed(
  () =>
    new Set(
      scopeGroups.value.flatMap(group => group.options.map(item => item.value))
    )
);

const customPathList = computed(() =>
  form.customPaths
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean)
);

/* ---------------- 审批人选择器（候选目录：审批模块自给自足） ---------------- */

const userOptions = ref<Array<{ username: string; label: string }>>([]);
const roleOptions = ref<Array<{ name: string; code: string }>>([]);

function splitValues(value: string): string[] {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function joinValues(values: unknown): string {
  return (Array.isArray(values) ? values : [values]).map(String).join(",");
}

/** 级次行内下拉回写：多选数组 → 逗号串（服务端契约） */
function updateLevelValue(index: number, value: unknown) {
  const level = form.levels[index];
  if (!level) return;
  level.assignee_list = (Array.isArray(value) ? value : [value]).map(String);
  level.assignee_value = joinValues(value);
}

/** 切换审批人类型：清空已选（用户名与角色 code 不通用） */
function onAssigneeTypeChange(index: number) {
  const level = form.levels[index];
  if (!level) return;
  level.assignee_list = [];
  level.assignee_value = "";
}

function addLevel() {
  form.levels.push({
    name: "",
    approve_type: "OR",
    assignee_type: "user",
    assignee_value: "",
    assignee_list: []
  });
}

function removeLevel(index: number) {
  form.levels.splice(index, 1);
}

/** 上移/下移：级次顺序即审批顺序（服务端按数组下标重排 order） */
function moveLevel(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= form.levels.length) return;
  const [row] = form.levels.splice(index, 1);
  form.levels.splice(target, 0, row);
}

onMounted(async () => {
  if (props.row) {
    form.name = String(props.row.name ?? "");
    form.priority = Number(props.row.priority ?? 0);
    form.is_active = Boolean(props.row.is_active);
    form.remark = String(props.row.remark ?? "");
    form.levels = ((props.row.levels ?? []) as Array<RecordType>).map(
      level => ({
        name: String(level.name ?? ""),
        approve_type: String(level.approve_type ?? "OR"),
        assignee_type: String(level.assignee_type ?? "user"),
        assignee_value: String(level.assignee_value ?? ""),
        assignee_list: splitValues(String(level.assignee_value ?? ""))
      })
    );
  }
  if (form.levels.length === 0) addLevel();

  await loadScopeGroups();

  // 已保存路径分流：命中目录的进勾选，其余（历史正则/白名单接口）进自定义区，保证不丢
  const saved = ((props.row?.path_patterns ?? []) as Array<string>).map(String);
  if (saved.length) {
    form.pathSelected = saved.filter(item => knownPaths.value.has(item));
    const rest = saved.filter(item => !knownPaths.value.has(item));
    if (rest.length) form.customPaths = rest.join("\n");
  }

  // 审批人候选目录（审批模块自带端点，不依赖搜索模块；前端本地过滤）
  const res = await approvalRuleApi.candidateOptions().catch(() => null);
  if (res && res.code === SUCCESS_CODE && res.data) {
    userOptions.value = ((res.data.users ?? []) as Array<RecordType>).map(
      user => ({
        username: String(user.username),
        label: user.nickname
          ? `${user.nickname}(${user.username})`
          : String(user.username)
      })
    );
    roleOptions.value = ((res.data.roles ?? []) as Array<RecordType>).map(
      role => ({ code: String(role.code), name: String(role.name) })
    );
  }
});

/** 提交载荷：校验失败返回 null（ReDialog beforeSure 约定） */
async function getPayload() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return null;
  const merged = [...form.pathSelected, ...customPathList.value];
  const paths = merged.filter((item, index) => merged.indexOf(item) === index);
  if (paths.length === 0) return null;
  const levels = form.levels.map((level, index) => ({
    order: index + 1,
    name: level.name ?? "",
    approve_type: level.approve_type,
    assignee_type: level.assignee_type,
    assignee_value: level.assignee_value
  }));
  return {
    name: form.name.trim(),
    path_patterns: paths,
    priority: Number(form.priority ?? 0),
    is_active: form.is_active,
    remark: form.remark?.trim() || null,
    levels
  };
}

defineExpose({ getPayload });
</script>

<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-width="96px"
    class="pr-4"
  >
    <el-form-item :label="t('approvalRule.formName')" prop="name">
      <el-input
        v-model="form.name"
        :placeholder="t('approvalRule.formNameTip')"
      />
    </el-form-item>

    <el-form-item :label="t('approvalRule.formPaths')">
      <div v-loading="scopeLoading" class="w-full">
        <el-select
          v-model="form.pathSelected"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="3"
          class="w-full!"
          :placeholder="t('approvalRule.pathsPlaceholder')"
        >
          <el-option-group
            v-for="group in scopeGroups"
            :key="group.key"
            :label="labelOf(group.title)"
          >
            <el-option
              v-for="option in group.options"
              :key="option.value"
              :value="option.value"
              :label="`${option.method} ${option.label}`"
            >
              <div class="flex w-full items-center gap-2">
                <el-tag size="small" effect="plain">{{ option.method }}</el-tag>
                <span class="truncate">{{ option.label }}</span>
                <span class="ml-auto pl-4 text-xs text-gray-400">
                  {{ option.path }}
                </span>
              </div>
            </el-option>
          </el-option-group>
        </el-select>
        <div class="el-form-item__help mt-1">
          {{ t("approvalRule.pathsTip") }}
        </div>
        <el-input
          v-model="form.customPaths"
          type="textarea"
          :rows="2"
          class="mt-2"
          :placeholder="t('approvalRule.pathsCustomTip')"
        />
      </div>
    </el-form-item>

    <el-form-item :label="t('approvalRule.formPriority')">
      <el-input-number
        v-model="form.priority"
        :min="0"
        controls-position="right"
      />
      <span class="ml-2 text-xs text-gray-500">
        {{ t("approvalRule.formPriorityTip") }}
      </span>
    </el-form-item>
    <el-form-item :label="t('approvalRule.formActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
    <el-form-item :label="t('approvalRule.formRemark')">
      <el-input v-model="form.remark" />
    </el-form-item>

    <el-form-item :label="t('approvalRule.levels')">
      <div class="w-full">
        <p class="mb-2 text-xs text-gray-500">
          {{ t("approvalRule.levelsTip") }}
        </p>
        <el-table :data="form.levels" size="small" border>
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
                <el-option
                  :label="t('approvalRule.approveTypeOR')"
                  value="OR"
                />
                <el-option
                  :label="t('approvalRule.approveTypeAND')"
                  value="AND"
                />
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
                <el-option
                  :label="t('approvalRule.levelTypeUser')"
                  value="user"
                />
                <el-option
                  :label="t('approvalRule.levelTypeRole')"
                  value="role"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            :label="t('approvalRule.levelAssignee')"
            min-width="210"
          >
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
                v-else
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
                :disabled="$index === form.levels.length - 1"
                @click="moveLevel($index, 1)"
              >
                {{ t("approvalRule.moveDown") }}
              </el-button>
              <el-button
                link
                type="danger"
                size="small"
                :disabled="form.levels.length <= 1"
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
    </el-form-item>
  </el-form>
</template>
