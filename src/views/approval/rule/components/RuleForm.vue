<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { FormInstance, FormRules } from "element-plus";
import type { RecordType } from "plus-pro-components";
import { SUCCESS_CODE } from "@/api/types";
import { loadPatScopeCatalog } from "@/api/user/token";
import { message } from "@/utils/message";
import type { ScopeGroup } from "@/utils/scopeDisplay";
import { splitValues } from "@/views/approval/utils/assigneeValues";
import RuleLevelsEditor from "./RuleLevelsEditor.vue";
import { createLevelRow, type LevelRow } from "../utils/types";

defineOptions({ name: "ApprovalRuleForm" });

/**
 * 审批规则表单（多级审批链）：
 *
 * - **匹配路径**：从「接口清单」（与访问令牌同一份目录，按本人权限收口）勾选，
 *   或在下方的自定义区写路径正则（高级用法，含历史数据回显）；
 * - **审批级次**：按顺序逐级审批，支持上移/下移排序；
 * - **级内多人**：或签（任一通过即进入下一级）/ 会签（全部通过才进入下一级）；
 * - **审批人**：指定用户走远程搜索（可多选，允许直接输入用户名兜底）/ 角色下拉 /
 *   岗位下拉（按岗位 code 解析在岗用户，仅启用岗位）；保存时服务端校验
 *   用户名/角色 code/岗位 code 存在性。
 */
const props = defineProps<{ row?: RecordType | null }>();

const { t, te } = useI18n();
const formRef = ref<FormInstance>();

/** 限定方法候选项（与后端 RULE_METHODS 白名单同源；空清单 = 不限方法） */
const METHOD_OPTIONS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD"
];

const form = reactive({
  name: "",
  /** 勾选自接口清单的路径（锚定路径正则） */
  pathSelected: [] as Array<string>,
  /** 自定义路径正则（一行一条） */
  customPaths: "",
  /** 限定命中的 HTTP 方法（空 = 全部方法） */
  methods: [] as Array<string>,
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

/* 审批人候选与级次增删改上移下移：见 RuleLevelsEditor（同一份候选目录） */

onMounted(async () => {
  if (props.row) {
    form.name = String(props.row.name ?? "");
    form.priority = Number(props.row.priority ?? 0);
    form.is_active = Boolean(props.row.is_active);
    form.remark = String(props.row.remark ?? "");
    form.methods = ((props.row.methods ?? []) as Array<string>).map(String);
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
  if (form.levels.length === 0) form.levels.push(createLevelRow());

  await loadScopeGroups();

  // 已保存路径分流：命中目录的进勾选，其余（历史正则/白名单接口）进自定义区，保证不丢
  const saved = ((props.row?.path_patterns ?? []) as Array<string>).map(String);
  if (saved.length) {
    form.pathSelected = saved.filter(item => knownPaths.value.has(item));
    const rest = saved.filter(item => !knownPaths.value.has(item));
    if (rest.length) form.customPaths = rest.join("\n");
  }
});

/** 提交载荷：校验失败返回 null（ReDialog beforeSure 约定），路径必选同步给出提示 */
async function getPayload() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return null;
  const merged = [...form.pathSelected, ...customPathList.value];
  const paths = merged.filter((item, index) => merged.indexOf(item) === index);
  if (paths.length === 0) {
    message(t("approvalRule.pathsRequired"), { type: "error" });
    return null;
  }
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
    methods: form.methods,
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
                <span
                  class="ml-auto pl-4 text-xs text-(--el-text-color-secondary)"
                >
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

    <el-form-item :label="t('approvalRule.formMethods')">
      <div class="w-full">
        <el-select
          v-model="form.methods"
          multiple
          clearable
          collapse-tags
          collapse-tags-tooltip
          class="w-full!"
          :placeholder="t('approvalRule.methodsPlaceholder')"
        >
          <el-option
            v-for="method in METHOD_OPTIONS"
            :key="method"
            :value="method"
            :label="method"
          />
        </el-select>
        <div class="el-form-item__help mt-1">
          {{ t("approvalRule.methodsTip") }}
        </div>
      </div>
    </el-form-item>

    <el-form-item :label="t('approvalRule.formPriority')">
      <el-input-number
        v-model="form.priority"
        :min="0"
        controls-position="right"
      />
      <span class="ml-2 text-xs text-(--el-text-color-regular)">
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
      <RuleLevelsEditor v-model:levels="form.levels" />
    </el-form-item>
  </el-form>
</template>
